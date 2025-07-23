import asyncio
import json
import logging
from datetime import datetime, timedelta

import asyncpg
import msgspec

from config.environments import Environment
from utils.database.workorders_history_db import WorkordersHistroyDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class WorkordersDB(BaseWithDBPool):
    TABLE_NAME = "workorders"

    def __init__(self):
        self.db_pool = None
        self.cache = {}
        self.workorders_history_db = WorkordersHistroyDB()
        self.cache_expiry = timedelta(seconds=60)
        self._stop_background = False
        self._background_task = None
        self._cache_refresh_queue = set()

    async def connect(self):
        if self.db_pool is None or self.db_pool._closed:
            try:
                self.db_pool = await asyncpg.create_pool(
                    user=Environment.POSTGRES_USER,
                    password=Environment.POSTGRES_PASSWORD,
                    database=Environment.POSTGRES_DB,
                    host=Environment.POSTGRES_HOST,
                    port=Environment.POSTGRES_PORT,
                    min_size=Environment.POSTGRES_MIN_POOL_SIZE,
                    max_size=Environment.POSTGRES_MAX_POOL_SIZE,
                    timeout=Environment.POSTGRES_TIMEOUT,
                    command_timeout=Environment.POSTGRES_COMMAND_TIMEOUT,
                    max_inactive_connection_lifetime=Environment.POSTGRES_MAX_INACTIVE_CONNECTION_LIFETIME,
                )
                await self._create_table_if_not_exists()
            except asyncpg.exceptions.PostgresError as e:
                logging.error(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        query = f"""
        CREATE TABLE IF NOT EXISTS {self.TABLE_NAME} (
            id SERIAL PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    def _get_cache(self, key):
        item = self.cache.get(key)
        if item:
            value, timestamp = item
            if datetime.now() - timestamp < self.cache_expiry:
                return value
        return None

    def _set_cache(self, key, value):
        self.cache[key] = (value, datetime.now())

    def _invalidate_cache(self, key_startswith):
        self.cache = {k: v for k, v in self.cache.items() if not k.startswith(key_startswith)}

    def start_background_cache_worker(self):
        async def background_workorder():
            while not self._stop_background:
                try:
                    await self._warm_cache()
                except Exception as e:
                    logging.warning(f"[CacheWorker] Error warming cache: {e}")
                await asyncio.sleep(Environment.WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL)

        if self._background_task is None:
            self._background_task = asyncio.create_task(background_workorder())

    def stop_background_cache_worker(self):
        self._stop_background = True

    async def _warm_cache(self):
        if self._cache_refresh_queue:
            workorder_ids = list(self._cache_refresh_queue)
            self._cache_refresh_queue.clear()
        else:
            workorder_ids = [workorder["id"] for workorder in await self.get_all_workorders()]

        for workorder_id in workorder_ids:
            workorder = await self.get_workorder_by_id(workorder_id, include_data=True)
            if workorder:
                self._set_cache(f"workorder_{workorder_id}_full", workorder)

    @ensure_connection
    async def get_all_workorders(self, include_data: bool = False):
        cache_key = "all_workorders"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME}"

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        workorders = []
        for row in rows:
            workorder = msgspec.json.decode(row["data"])
            workorder["id"] = row["id"]
            workorders.append(workorder)

        self._set_cache(cache_key, workorders)
        return workorders

    @ensure_connection
    async def get_workorder_id_by_name(self, workorder_name: str) -> int | None:
        query = f"""
        SELECT id FROM {self.TABLE_NAME}
        WHERE name = $1
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, workorder_name)
        return row["id"] if row else None

    @ensure_connection
    async def get_workorder_by_id(self, workorder_id: int | str):
        if isinstance(workorder_id, str):
            workorder_id = await self.get_workorder_id_by_name(workorder_id)
            if workorder_id is None:
                return None

        cache_key = f"workorder_{workorder_id}_full"
        if cached := self._get_cache(cache_key):
            return cached

        query = f"""
        SELECT id, data, created_at, updated_at
        FROM {self.TABLE_NAME}
        WHERE id = $1
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, workorder_id)

        if not row:
            return None

        workorder = msgspec.json.decode(row["data"])
        self._set_cache(cache_key, workorder)
        return workorder

    @ensure_connection
    async def save_workorder(self, workorder_id: int | str, new_data: dict, modified_by: str = "system") -> int:
        if isinstance(workorder_id, str):
            workorder_id = await self.get_workorder_id_by_name(workorder_id)

        workorder_does_not_exist = False

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                current_row = await conn.fetchrow(f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", workorder_id)

                if current_row is None:
                    workorder_does_not_exist = True
                else:
                    # Record history in background
                    task = asyncio.create_task(self.workorders_history_db.insert_history_workorder(workorder_id, new_data, modified_by))
                    task.add_done_callback(lambda t: logging.error("Unhandled task error", exc_info=t.exception()) if t.exception() else None)

                    # Proceed with update
                    await conn.execute(
                        f"""
                        UPDATE {self.TABLE_NAME} SET
                            data = $2, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                        """,
                        workorder_id,
                        json.dumps(new_data),
                    )

        if workorder_does_not_exist:
            logging.info(f"[Saveworkorder] workorder ID {workorder_id} not found. Creating new workorder.")
            new_id = await self.add_workorder(new_data)
            # Optional: write to history right after creation
            # await self.workorders_history_db.insert_history_workorder(new_id, new_data, modified_by)
            return new_id

        self._invalidate_cache(f"workorder_{workorder_id}")
        self._invalidate_cache("all_workorders")
        return workorder_id

    @ensure_connection
    async def add_workorder(self, workorder_data: dict):
        query = f"""
        INSERT INTO {self.TABLE_NAME} (data)
        VALUES ($1)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                json.dumps(workorder_data),
            )

        workorder_id = row["id"]
        self._invalidate_cache("all_workorders")
        self._invalidate_cache(f"workorder_{workorder_id}_")
        return workorder_id

    @ensure_connection
    async def delete_workorder(self, workorder_id: int):
        if isinstance(workorder_id, str):
            workorder_id = await self.get_workorder_id_by_name(workorder_id)
        query = f"DELETE FROM {self.TABLE_NAME} WHERE id = $1"
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, workorder_id)

        self._invalidate_cache("all_workorders")
        self._invalidate_cache(f"workorder_{workorder_id}_")

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None
