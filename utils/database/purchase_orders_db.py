import asyncio
import json
import logging
from datetime import datetime, timedelta

import asyncpg
import msgspec

from config.environments import Environment
from utils.database.purchase_orders_history_db import PurchaseOrdersHistoryDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class PurchaseOrdersDB(BaseWithDBPool):
    TABLE_NAME = "purchase_orders"

    def __init__(self):
        self.db_pool = None
        self.cache = {}
        self.purchase_orders_history_db = PurchaseOrdersHistoryDB()
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
            name TEXT NOT NULL,
            vendor_name TEXT NOT NULL,
            purchase_order_number INTEGER NOT NULL,
            is_draft BOOLEAN NOT NULL DEFAULT FALSE,
            purchase_order_data JSONB NOT NULL,
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
        async def background_purchase_order():
            while not self._stop_background:
                try:
                    await self._warm_cache()
                except Exception as e:
                    logging.warning(f"[CacheWorker] Error warming cache: {e}")
                await asyncio.sleep(Environment.WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL)

        if self._background_task is None:
            self._background_task = asyncio.create_task(background_purchase_order())

    def stop_background_cache_worker(self):
        self._stop_background = True

    async def _warm_cache(self):
        if self._cache_refresh_queue:
            purchase_order_ids = list(self._cache_refresh_queue)
            self._cache_refresh_queue.clear()
        else:
            purchase_order_ids = [purchase_order["id"] for purchase_order in await self.get_all_purchase_orders(include_data=True)]

        for purchase_order_id in purchase_order_ids:
            purchase_order = await self.get_purchase_order_by_id(purchase_order_id)
            if purchase_order:
                self._set_cache(f"purchase_order_{purchase_order_id}_full", purchase_order)

    @ensure_connection
    async def get_all_purchase_orders(self, include_data: bool = False):
        cache_key = "all_purchase_orders_data" if include_data else "all_purchase_orders"

        cached = self._get_cache(cache_key)
        if cached:
            return cached

        query = f"SELECT id, purchase_order_data FROM {self.TABLE_NAME}"

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        purchase_orders = []
        for row in rows:
            po_dict = dict(row)
            po_dict["purchase_order_data"] = msgspec.json.decode(po_dict["purchase_order_data"])
            po_dict["purchase_order_data"]["id"] = po_dict["id"]
            if not include_data:
                po_dict["purchase_order_data"]["components"] = []
                po_dict["purchase_order_data"]["sheets"] = []
            purchase_orders.append(po_dict)

        self._set_cache(cache_key, purchase_orders)
        return purchase_orders

    @ensure_connection
    async def get_purchase_order_id_by_name(self, purchase_order_name: str) -> int | None:
        query = f"""
        SELECT id FROM {self.TABLE_NAME}
        WHERE name = $1
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, purchase_order_name)
        return row["id"] if row else None

    @ensure_connection
    async def get_purchase_order_by_id(self, purchase_order_id: int | str):
        if isinstance(purchase_order_id, str):
            purchase_order_id = await self.get_purchase_order_id_by_name(purchase_order_id)
            if purchase_order_id is None:
                return None

        cache_key = f"purchase_order_{purchase_order_id}_meta"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        query = f"""
        SELECT id, purchase_order_data
        FROM {self.TABLE_NAME}
        WHERE id = $1
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, purchase_order_id)

        if not row:
            return None

        po_dict = dict(row)
        po_dict["purchase_order_data"] = msgspec.json.decode(po_dict["purchase_order_data"])

        self._set_cache(cache_key, po_dict)
        return po_dict

    @ensure_connection
    async def save_purchase_order(self, purchase_order_id: int | str, new_data: dict, modified_by: str = "system"):
        if isinstance(purchase_order_id, str):
            purchase_order_id = await self.get_purchase_order_id_by_name(purchase_order_id)

        purchase_order_does_not_exist = False

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                current_row = await conn.fetchrow(f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", purchase_order_id)

                if current_row is None:
                    purchase_order_does_not_exist = True
                else:
                    # Insert history in background
                    task = asyncio.create_task(self.purchase_orders_history_db.insert_history_purchase_order(purchase_order_id, new_data, modified_by))
                    task.add_done_callback(lambda t: logging.error("Unhandled task error", exc_info=t.exception()) if t.exception() else None)

                    meta_data = new_data.get("meta_data", {})
                    vendor = meta_data.get("vendor", {})
                    vendor_name = vendor.get("name", "")
                    purchase_order_number = meta_data.get("purchase_order_number", 0)
                    name = f"{vendor_name} #{purchase_order_number}"

                    await conn.execute(
                        f"""
                        UPDATE {self.TABLE_NAME} SET
                            name = $2,
                            vendor_name = $3,
                            purchase_order_number = $4,
                            purchase_order_data = $5,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                        """,
                        purchase_order_id,
                        name,
                        vendor_name,
                        purchase_order_number,
                        json.dumps(new_data),
                    )

        if purchase_order_does_not_exist:
            logging.info(f"[SavePurchaseOrder] ID {purchase_order_id} not found. Creating new.")
            new_id = await self.add_purchase_order(new_data)
            # Optional: add immediate history record after add
            await self.purchase_orders_history_db.insert_history_purchase_order(new_id, new_data, modified_by)
            return new_id

        self._invalidate_cache(f"purchase_order_{purchase_order_id}")
        self._invalidate_cache("all_purchase_orders")
        return purchase_order_id

    @ensure_connection
    async def add_purchase_order(self, purchase_order: dict) -> int:
        meta_data = purchase_order.get("meta_data", {})
        vendor = meta_data.get("vendor", {})
        vendor_name = vendor.get("name", "")
        purchase_order_number = meta_data.get("purchase_order_number", 0)

        name = f"{vendor_name} #{purchase_order_number}"

        sql = f"""
        INSERT INTO {self.TABLE_NAME} (name, vendor_name, purchase_order_number, purchase_order_data)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                sql,
                name,
                vendor_name,
                purchase_order_number,
                json.dumps(purchase_order),
            )

        purchase_order_id = row["id"]
        self._invalidate_cache("all_purchase_orders")
        self._invalidate_cache(f"purchase_order_{purchase_order_id}_")
        return purchase_order_id

    @ensure_connection
    async def mark_purchase_order_email_sent(
        self,
        purchase_order_id: int,
        modified_by: str = "system",
    ):
        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    f"""
                    SELECT purchase_order_data
                    FROM {self.TABLE_NAME}
                    WHERE id = $1
                    """,
                    purchase_order_id,
                )

                if not row:
                    return False

                po_data = msgspec.json.decode(row["purchase_order_data"])

                meta = po_data.setdefault("meta_data", {})
                meta["email_sent_at"] = datetime.utcnow().isoformat()

                # history
                asyncio.create_task(self.purchase_orders_history_db.insert_history_purchase_order(purchase_order_id, po_data, modified_by))

                await conn.execute(
                    f"""
                    UPDATE {self.TABLE_NAME}
                    SET
                        purchase_order_data = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    """,
                    purchase_order_id,
                    json.dumps(po_data),
                )

        self._invalidate_cache(f"purchase_order_{purchase_order_id}")
        self._invalidate_cache("all_purchase_orders")
        return True

    @ensure_connection
    async def delete_purchase_order(self, purchase_order_id: int):
        if isinstance(purchase_order_id, str):
            purchase_order_id = await self.get_purchase_order_id_by_name(purchase_order_id)
        query = f"DELETE FROM {self.TABLE_NAME} WHERE id = $1"
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, purchase_order_id)

        self._invalidate_cache("all_purchase_orders")
        self._invalidate_cache("all_purchase_orders_data")
        self._invalidate_cache(f"purchase_order_{purchase_order_id}_")

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None
