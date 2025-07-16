import asyncio
import json
import logging

import asyncpg
import msgspec
from dotenv import load_dotenv

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class JobsHistroyDB(BaseWithDBPool):
    def __init__(self):
        self.db_pool = None
        load_dotenv()

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
                logging.info(f"[HistoryDB] Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        table_query = """
        CREATE TABLE IF NOT EXISTS jobs_history (
            id SERIAL PRIMARY KEY,
            job_id INT REFERENCES jobs(id) ON DELETE SET NULL,
            version INT NOT NULL,
            name TEXT,
            job_data JSONB,
            nests JSONB,
            assemblies JSONB,
            diff_from JSONB,
            diff_to JSONB,
            modified_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        index_unique_query = """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_history_version
        ON jobs_history (job_id, version);
        """

        index_lookup_query = """
        CREATE INDEX IF NOT EXISTS idx_jobs_history_job_id
        ON jobs_history (job_id);
        """

        if self.db_pool:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(table_query)
                    await conn.execute(index_unique_query)
                    await conn.execute(index_lookup_query)

    @ensure_connection
    async def insert_history_job(self, job_id: int | str, new_data: dict, modified_by: str = "system"):
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                async with self.db_pool.acquire() as conn:
                    async with conn.transaction():
                        latest = await conn.fetchrow(
                            """
                            SELECT job_data, nests, assemblies, version
                            FROM jobs_history
                            WHERE job_id = $1
                            ORDER BY version DESC
                            LIMIT 1
                            """,
                            job_id,
                        )

                        version = 1
                        diff_from = {}
                        diff_to = {}
                        if latest:
                            version = latest["version"] + 1
                            prev_combined = {
                                "job_data": msgspec.json.decode(latest["job_data"]),
                                "nests": msgspec.json.decode(latest["nests"]),
                                "assemblies": msgspec.json.decode(latest["assemblies"]),
                            }
                            new_combined = {
                                "job_data": new_data.get("job_data"),
                                "nests": new_data.get("nests"),
                                "assemblies": new_data.get("assemblies"),
                            }
                            diff = self.compute_diff(prev_combined, new_combined)

                            if not diff:  # No difference found
                                return

                            diff_from = {k: v["from"] for k, v in diff.items()}
                            diff_to = {k: v["to"] for k, v in diff.items()}

                        job_data = new_data.get("job_data", {})
                        nests = new_data.get("nests", [])
                        assemblies = new_data.get("assemblies", [])
                        name = job_data.get("name")

                        await conn.execute(
                            """
                            INSERT INTO jobs_history (
                                job_id, version, name, job_data, nests, assemblies,
                                diff_from, diff_to, modified_by, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                            """,
                            job_id,
                            version,
                            name,
                            json.dumps(job_data),
                            json.dumps(nests),
                            json.dumps(assemblies),
                            json.dumps(diff_from),
                            json.dumps(diff_to),
                            modified_by,
                        )
                return
            except asyncpg.UniqueViolationError:
                logging.warning(f"[History Insert] Version conflict at version {version}, retrying...")
                await asyncio.sleep(attempt)
            except Exception as e:
                logging.error(f"[History Insert Error] Attempt {attempt}: {e}")
                if attempt == max_retries:
                    logging.error("[History Insert] FAILED after all retries.")

    @ensure_connection
    async def get_job_history_diff(self, job_id: int):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT version, job_data, nests, assemblies FROM jobs_history WHERE job_id = $1 ORDER BY version",
                job_id,
            )

        versions = [
            {
                "job_data": json.loads(row["job_data"]),
                "nests": json.loads(row["nests"]),
                "assemblies": json.loads(row["assemblies"]),
            }
            for row in rows
        ]

        diffs = []
        for i in range(1, len(versions)):
            diff = self.compute_diff(versions[i - 1], versions[i])
            diffs.append({"from_version": i, "to_version": i + 1, "changes": diff})

        return diffs

    def compute_diff(self, prev, current, path="") -> dict:
        changes = {}

        if isinstance(prev, dict) and isinstance(current, dict):
            all_keys = set(prev) | set(current)
            for key in all_keys:
                sub_path = f"{path}.{key}" if path else key
                changes.update(self.compute_diff(prev.get(key), current.get(key), sub_path))

        elif isinstance(prev, list) and isinstance(current, list):
            if prev != current:
                changes[path] = {"from": prev, "to": current}

        else:
            if prev != current:
                changes[path] = {"from": prev, "to": current}

        return changes
