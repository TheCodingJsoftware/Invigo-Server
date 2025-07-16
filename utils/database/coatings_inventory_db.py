import asyncio
import json
import logging

import asyncpg
from dotenv import load_dotenv

from config.environments import Environment
from utils.cache.inventory_cache_manager import InventoryCacheManager
from utils.database.item_history_db import ItemHistoryDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class CoatingsInventoryDB(BaseWithDBPool):
    TABLE_NAME = "coatings_inventory"

    def __init__(self):
        self.db_pool = None
        self.cache_manager = InventoryCacheManager(expiry_seconds=1)
        self.coatings_history_db = ItemHistoryDB("coating")
        load_dotenv()
        self.cache_manager.schedule_refresh("all_coatings", self.get_all_coatings_no_cache, 60)

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
                await self.cache_manager.start()
            except asyncpg.exceptions.PostgresError as e:
                logging.error(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        query = f"""
        CREATE TABLE IF NOT EXISTS {self.TABLE_NAME} (
            id SERIAL PRIMARY KEY,
            component_id INTEGER NOT NULL REFERENCES components_inventory(id) ON DELETE CASCADE,
            part_name TEXT NOT NULL,
            part_number TEXT NOT NULL,
            coating_type TEXT NOT NULL,
            color TEXT NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        if self.db_pool:
            async with self.db_pool.acquire() as conn:
                await conn.execute(query)

    @ensure_connection
    async def get_paints_by_category(self, category: str) -> list[dict]:
        key = f"paints_category_{category.lower()}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT data FROM {self.TABLE_NAME} WHERE $1 = coating_type"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, category)

        paints = [json.loads(row["data"]) for row in rows]
        self.cache_manager.set(key, paints)
        return paints

    @ensure_connection
    async def get_coating(self, coating_id: int | str) -> dict | None:
        key = f"coating_{coating_id}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1" if isinstance(coating_id, int) else f"SELECT * FROM {self.TABLE_NAME} WHERE part_number = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, coating_id)

        if row:
            json_data = json.loads(row["data"])
            json_data["id"] = row["id"]
            self.cache_manager.set(key, json_data)
            return json_data
        return None

    @ensure_connection
    async def coating_exists(self, coating_name: str) -> bool:
        query = f"SELECT 1 FROM {self.TABLE_NAME} WHERE part_number = $1"
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(query, coating_name) is not None

    @ensure_connection
    async def get_all_coatings(self) -> list[dict]:
        key = "all_coatings"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        coatings = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            coatings.append(json_data)

        self.cache_manager.set(key, coatings)
        return coatings

    @ensure_connection
    async def get_categories(self) -> list[str]:
        key = "all_categories"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT coating_type FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        all_categories = sorted({cat for row in rows if row for cat in row})
        self.cache_manager.set(key, all_categories)
        return all_categories

    @ensure_connection
    async def get_all_coatings_no_cache(self) -> list[dict]:
        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        coatings = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            coatings.append(json_data)

        return coatings

    @ensure_connection
    async def add_coating(self, data: dict):
        query = f"""
        INSERT INTO {self.TABLE_NAME} (
            component_id, part_name, part_number,
            coating_type, color, data
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(
                query,
                data.get("component_id"),
                data.get("part_name"),
                data.get("part_number"),
                data.get("coating_type"),
                data.get("color"),
                json.dumps(data),
            )

    @ensure_connection
    async def save_coating(self, coating_id: int | str, new_data: dict, modified_by: str = "system"):
        if isinstance(coating_id, str):
            coating_id = await self.get_coating_id(coating_id)
            new_data["id"] = coating_id

        coating_does_not_exist = False

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                current_row = await conn.fetchrow(f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", coating_id)

                if current_row is None:
                    coating_does_not_exist = True
                else:
                    # Record history in background
                    task = asyncio.create_task(self.coatings_history_db.insert_history_item(coating_id, new_data, modified_by))
                    task.add_done_callback(lambda t: logging.error("Unhandled task error", exc_info=t.exception()) if t.exception() else None)

                    await conn.execute(
                        f"""
                        UPDATE {self.TABLE_NAME} SET
                            component_id = $2, part_name = $3, part_number = $4,
                            coating_type = $5, color = $6, data = $7,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                        """,
                        coating_id,
                        new_data.get("component_id"),
                        new_data.get("part_name"),
                        new_data.get("part_number"),
                        new_data.get("coating_type"),
                        new_data.get("color"),
                        json.dumps(new_data),
                    )

        if coating_does_not_exist:
            logging.info(f"[SaveCoating] Coating ID {coating_id} not found. Creating new coating.")
            new_id = await self.add_coating(new_data)
            return new_id

        self.cache_manager.invalidate(f"coating_{coating_id}")
        self.cache_manager.invalidate("all_coatings")
        return coating_id

    @ensure_connection
    async def get_coating_id(self, coating_name: str) -> int:
        query = f"SELECT id FROM {self.TABLE_NAME} WHERE part_number = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, coating_name)
        return row["id"] if row else -1

    @ensure_connection
    async def delete_coating(self, coating_id: int | str) -> bool:
        query = f"DELETE FROM {self.TABLE_NAME} WHERE id = $1 RETURNING id" if isinstance(coating_id, int) else f"DELETE FROM {self.TABLE_NAME} WHERE part_number = $1 RETURNING id"
        async with self.db_pool.acquire() as conn:
            deleted_id = await conn.fetchval(query, coating_id)

        self.cache_manager.invalidate(f"coating_{coating_id}")
        self.cache_manager.invalidate("all_coatings")
        return deleted_id is not None

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
        await self.cache_manager.shutdown()
