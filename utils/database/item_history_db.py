import asyncio
import json
import logging

import asyncpg
from dotenv import load_dotenv

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class ItemHistoryDB(BaseWithDBPool):
    def __init__(self, item_name: str):
        self.db_pool = None
        self.item_name = item_name
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
        table_query = f"""
        CREATE TABLE IF NOT EXISTS {self.item_name}s_inventory_history (
            id SERIAL PRIMARY KEY,
            {self.item_name}_id INT REFERENCES {self.item_name}s_inventory(id) ON DELETE SET NULL,
            version INT NOT NULL,
            name TEXT NOT NULL,
            modified_by TEXT NOT NULL,
            data JSONB NOT NULL,
            diff_from JSONB NOT NULL,
            diff_to JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """

        index_unique_query = f"""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_{self.item_name}_version
        ON {self.item_name}s_inventory_history ({self.item_name}_id, version);
        """

        index_lookup_query = f"""
        CREATE INDEX IF NOT EXISTS idx_{self.item_name}_id
        ON {self.item_name}s_inventory_history ({self.item_name}_id);
        """

        if self.db_pool:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(table_query)
                    await conn.execute(index_unique_query)
                    await conn.execute(index_lookup_query)

    @ensure_connection
    async def insert_history_item(self, item_id: int, new_data: dict, modified_by: str):
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                async with self.db_pool.acquire() as conn:
                    async with conn.transaction():
                        # Get previous entry (if any)
                        latest = await conn.fetchrow(
                            f"""
                                SELECT data, version
                                FROM {self.item_name}s_inventory_history
                                WHERE {self.item_name}_id = $1
                                ORDER BY version DESC
                                LIMIT 1
                            """,
                            item_id,
                        )

                        if latest:
                            prev_data = json.loads(latest["data"])
                            version = latest["version"] + 1
                            diff = self.compute_diff(prev_data, new_data)

                            if not diff:  # No difference found
                                return

                            diff_from = {k: v["from"] for k, v in diff.items()}
                            diff_to = {k: v["to"] for k, v in diff.items()}
                        else:
                            version = 1
                            diff_from = {}
                            diff_to = new_data  # treat all as new

                        await conn.execute(
                            f"""
                            INSERT INTO {self.item_name}s_inventory_history (
                                {self.item_name}_id, version, name, modified_by, data, diff_from, diff_to, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                            """,
                            item_id,
                            version,
                            new_data.get("name"),
                            modified_by,
                            json.dumps(new_data),
                            json.dumps(diff_from),
                            json.dumps(diff_to),
                        )

                return
            except asyncpg.UniqueViolationError:
                logging.info(
                    f"[History Insert] Version {version} conflict, retrying..."
                )
                if attempt < max_retries:
                    await asyncio.sleep(attempt)
                else:
                    logging.info(
                        f"[History Insert] Gave up after {max_retries} attempts."
                    )
            except Exception as e:
                logging.info(f"[History Insert Error] Attempt {attempt}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(attempt)
                else:
                    logging.info(
                        f"[History Insert] FAILED after {max_retries} attempts."
                    )

    @ensure_connection
    async def get_item_history_diff(self, item_id: int):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT version, data FROM {self.item_name}s_inventory_history WHERE {self.item_name}_id = $1 ORDER BY version",
                item_id,
            )

        versions = [json.loads(row["data"]) for row in rows]
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
                changes.update(
                    self.compute_diff(prev.get(key), current.get(key), sub_path)
                )

        elif isinstance(prev, list) and isinstance(current, list):
            if prev != current:
                changes[path] = {"from": prev, "to": current}

        else:
            if prev != current:
                changes[path] = {"from": prev, "to": current}

        return changes
