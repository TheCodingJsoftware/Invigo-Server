import asyncio
import json
import logging
from datetime import datetime, timedelta

import asyncpg
import msgspec

from config.environments import Environment
from utils.database.jobs_history_db import JobsHistroyDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection
from utils.workspace.job import JobStatus


class JobsDB(BaseWithDBPool):
    TABLE_NAME = "jobs"

    def __init__(self):
        self.db_pool = None
        self.cache = {}
        self.jobs_history_db = JobsHistroyDB()
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
            status TEXT CHECK (status IN ('PLANNING', 'QUOTING', 'QUOTED', 'QUOTE_CONFIRMED', 'TEMPLATE', 'WORKSPACE', 'ARCHIVE')),
            name TEXT,
            job_data JSONB NOT NULL,
            nests JSONB NOT NULL,
            assemblies JSONB NOT NULL,
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
        self.cache = {
            k: v for k, v in self.cache.items() if not k.startswith(key_startswith)
        }

    def start_background_cache_worker(self):
        async def background_job():
            while not self._stop_background:
                try:
                    await self._warm_cache()
                except Exception as e:
                    logging.warning(f"[CacheWorker] Error warming cache: {e}")
                await asyncio.sleep(
                    Environment.WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL
                )

        if self._background_task is None:
            self._background_task = asyncio.create_task(background_job())

    def stop_background_cache_worker(self):
        self._stop_background = True

    async def _warm_cache(self):
        if self._cache_refresh_queue:
            job_ids = list(self._cache_refresh_queue)
            self._cache_refresh_queue.clear()
        else:
            job_ids = [job["id"] for job in await self.get_all_jobs()]

        for job_id in job_ids:
            job = await self.get_job_by_id(job_id, include_data=True)
            if job:
                self._set_cache(f"job_{job_id}_full", job)

    @ensure_connection
    async def get_all_jobs(self, include_data: bool = False):
        cache_key = "all_jobs_data" if include_data else "all_jobs"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if include_data:
            query = f"SELECT * FROM {self.TABLE_NAME}"
        else:
            query = f"SELECT id, name, status, job_data, created_at, updated_at FROM {self.TABLE_NAME}"

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        jobs = []
        for row in rows:
            job = dict(row)
            job["job_data"] = msgspec.json.decode(job["job_data"])
            if include_data:
                job["nests"] = msgspec.json.decode(job["nests"])
                job["assemblies"] = msgspec.json.decode(job["assemblies"])
            jobs.append(job)

        self._set_cache(cache_key, jobs)
        return jobs

    @ensure_connection
    async def get_job_id_by_name(self, job_name: str) -> int | None:
        query = f"""
        SELECT id FROM {self.TABLE_NAME}
        WHERE name = $1
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, job_name)
        return row["id"] if row else None

    @ensure_connection
    async def get_job_by_id(self, job_id: int | str, include_data: bool = True):
        if isinstance(job_id, str):
            job_id = await self.get_job_id_by_name(job_id)
            if job_id is None:
                return None

        cache_key = f"job_{job_id}_full" if include_data else f"job_{job_id}_meta"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if include_data:
            query = f"""
            SELECT id, name, status, job_data, nests, assemblies, created_at, updated_at
            FROM {self.TABLE_NAME}
            WHERE id = $1
            """
        else:
            query = f"""
            SELECT id, name, status, created_at, updated_at
            FROM {self.TABLE_NAME}
            WHERE id = $1
            """

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, job_id)

        if not row:
            return None

        job = dict(row)
        if include_data:
            job["job_data"] = msgspec.json.decode(job["job_data"])
            job["job_data"]["id"] = job_id
            job["nests"] = msgspec.json.decode(job["nests"])
            job["assemblies"] = msgspec.json.decode(job["assemblies"])

        self._set_cache(cache_key, job)
        return job

    @ensure_connection
    async def save_job(
        self, job_id: int | str, new_data: dict, modified_by: str = "system"
    ):
        if isinstance(job_id, str):
            job_id = await self.get_job_id_by_name(job_id)

        job_does_not_exist = False

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                current_row = await conn.fetchrow(
                    f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", job_id
                )

                if current_row is None:
                    job_does_not_exist = True
                else:
                    # Record history in background
                    task = asyncio.create_task(
                        self.jobs_history_db.insert_history_job(
                            job_id, new_data, modified_by
                        )
                    )
                    task.add_done_callback(
                        lambda t: logging.error(
                            "Unhandled task error", exc_info=t.exception()
                        )
                        if t.exception()
                        else None
                    )

                    job_data = new_data.get("job_data", {})
                    nests = new_data.get("nests", [])
                    assemblies = new_data.get("assemblies", [])
                    name = job_data.get("name")
                    type = job_data.get("type", 0)
                    status = JobStatus(type).name
                    # Proceed with update
                    await conn.execute(
                        f"""
                        UPDATE {self.TABLE_NAME} SET
                            status = $2, name = $3, job_data = $4, nests = $5, assemblies = $6,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                        """,
                        job_id,
                        status,
                        name,
                        json.dumps(job_data),
                        json.dumps(nests),
                        json.dumps(assemblies),
                    )

        if job_does_not_exist:
            logging.info(f"[SaveJob] Job ID {job_id} not found. Creating new job.")
            new_id = await self.add_job(new_data)
            # Optional: write to history right after creation
            # await self.jobs_history_db.insert_history_job(new_id, new_data, modified_by)
            return new_id

        self._invalidate_cache(f"job_{job_id}")
        self._invalidate_cache("all_jobs")
        return job_id

    @ensure_connection
    async def update_job_setting(
        self,
        job_id: int | str,
        key: str,
        value: str | bool | int | float,
        modified_by: str,
    ):
        if isinstance(job_id, str):
            job_id = await self.get_job_id_by_name(job_id)

        job_data = await self.get_job_by_id(job_id)

        job_data["job_data"][key] = value

        await self.save_job(job_id, job_data, modified_by)

        self._invalidate_cache(f"job_{job_id}")
        self._invalidate_cache("all_jobs")

    @ensure_connection
    async def add_job(self, job: dict):
        job_data = job.get("job_data", {})
        nests = job.get("nests", [])
        assemblies = job.get("assemblies", [])
        name = job_data.get("name")
        type = job_data.get("type", 0)
        status = JobStatus(type).name

        query = f"""
        INSERT INTO {self.TABLE_NAME} (status, name, job_data, nests, assemblies)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                status,
                name,
                json.dumps(job_data),
                json.dumps(nests),
                json.dumps(assemblies),
            )

        job_id = row["id"]
        self._invalidate_cache("all_jobs")
        self._invalidate_cache(f"job_{job_id}_")
        return job_id

    @ensure_connection
    async def delete_job(self, job_id: int):
        if isinstance(job_id, str):
            job_id = await self.get_job_id_by_name(job_id)
        query = f"DELETE FROM {self.TABLE_NAME} WHERE id = $1"
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, job_id)

        self._invalidate_cache("all_jobs")
        self._invalidate_cache(f"job_{job_id}_")

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None
