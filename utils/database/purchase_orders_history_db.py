import json
import logging

import asyncpg
from dotenv import load_dotenv

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class PurchaseOrdersHistoryDB(BaseWithDBPool):
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
                logging.info(f"[PurchaseOrdersHistoryDB] Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        query = """
        CREATE TABLE IF NOT EXISTS purchase_orders_history (
            id SERIAL PRIMARY KEY,
            purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE SET NULL,
            version INT NOT NULL,
            purchase_order_data JSONB,
            diff_from JSONB,
            diff_to JSONB,
            modified_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        index_query = """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_history_version
        ON purchase_orders_history (purchase_order_id, version);
        """
        if self.db_pool:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(query)
                    await conn.execute(index_query)

    @ensure_connection
    async def insert_history_purchase_order(self, purchase_order_id: int, new_data: dict, modified_by: str = "system"):
        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                latest = await conn.fetchrow(
                    """
                    SELECT purchase_order_data, version
                    FROM purchase_orders_history
                    WHERE purchase_order_id = $1
                    ORDER BY version DESC
                    LIMIT 1
                    """,
                    purchase_order_id,
                )

                version = 1
                diff_from = {}
                diff_to = {}
                if latest:
                    version = latest["version"] + 1
                    prev_data = json.loads(latest["purchase_order_data"])
                    diff = self.compute_diff(prev_data, new_data)

                    if not diff:  # No change, skip
                        return

                    diff_from = {k: v["from"] for k, v in diff.items()}
                    diff_to = {k: v["to"] for k, v in diff.items()}

                await conn.execute(
                    """
                    INSERT INTO purchase_orders_history (
                        purchase_order_id, version, purchase_order_data, diff_from, diff_to, modified_by, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                    """,
                    purchase_order_id,
                    version,
                    json.dumps(new_data),
                    json.dumps(diff_from),
                    json.dumps(diff_to),
                    modified_by,
                )

    def compute_diff(self, prev, current, path="") -> dict:
        changes = {}

        if isinstance(prev, dict) and isinstance(current, dict):
            keys = set(prev) | set(current)
            for key in keys:
                sub_path = f"{path}.{key}" if path else key
                changes.update(self.compute_diff(prev.get(key), current.get(key), sub_path))
        else:
            if prev != current:
                changes[path] = {"from": prev, "to": current}

        return changes
