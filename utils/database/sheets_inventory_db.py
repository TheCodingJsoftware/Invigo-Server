import asyncio
import json
import logging

import asyncpg
from dotenv import load_dotenv

from config.environments import Environment
from utils.cache.inventory_cache_manager import InventoryCacheManager
from utils.database.item_history_db import ItemHistoryDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class SheetsInventoryDB(BaseWithDBPool):
    TABLE_NAME = "sheets_inventory"

    def __init__(self):
        self.db_pool = None
        self.cache_manager = InventoryCacheManager(expiry_seconds=1)
        self.sheets_history_db = ItemHistoryDB("sheet")
        load_dotenv()
        self.cache_manager.schedule_refresh("all_sheets", self.get_all_sheets_no_cache, 60)
        self.cache_manager.schedule_refresh("all_categories", self.get_categories_no_cache, 60)

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
            name TEXT NOT NULL,
            thickness TEXT,
            material TEXT,
            width FLOAT,
            length FLOAT,
            categories TEXT[],
            quantity FLOAT DEFAULT 0,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def get_categories(self) -> list[str]:
        key = "all_categories"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT categories FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        all_categories = sorted({cat for row in rows if row["categories"] for cat in row["categories"]})
        self.cache_manager.set(key, all_categories)
        return all_categories

    @ensure_connection
    async def get_categories_no_cache(self) -> list[str]:
        query = f"SELECT categories FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        all_categories = sorted({cat for row in rows if row["categories"] for cat in row["categories"]})
        return all_categories

    @ensure_connection
    async def get_cutoff_sheets(self) -> list[dict]:
        return await self.get_sheets_by_category("Cutoff")

    @ensure_connection
    async def get_sheets_by_category(self, category: str) -> list[dict]:
        key = f"sheets_category_{category.lower()}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT data FROM {self.TABLE_NAME} WHERE $1 = ANY(categories)"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, category)

        sheets = [json.loads(row["data"]) for row in rows]
        self.cache_manager.set(key, sheets)
        return sheets

    @ensure_connection
    async def get_sheet(self, sheet_id: int | str) -> dict | None:
        key = f"sheet_{sheet_id}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1" if isinstance(sheet_id, int) else f"SELECT * FROM {self.TABLE_NAME} WHERE name = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, sheet_id)

        if row:
            json_data = json.loads(row["data"])
            json_data["id"] = row["id"]
            self.cache_manager.set(key, json_data)
            return json_data
        return None

    @ensure_connection
    async def sheet_exists(self, sheet_name: str) -> bool:
        query = f"SELECT 1 FROM {self.TABLE_NAME} WHERE name = $1"
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(query, sheet_name) is not None

    @ensure_connection
    async def get_all_sheets(self) -> list[dict]:
        key = "all_sheets"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        sheets = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            sheets.append(json_data)
        self.cache_manager.set(key, sheets)
        return sheets

    @ensure_connection
    async def get_all_sheets_no_cache(self) -> list[dict]:
        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        sheets = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            sheets.append(json_data)

        return sheets

    @ensure_connection
    async def add_sheet(self, data: dict):
        query = f"""
        INSERT INTO {self.TABLE_NAME} (
            name, thickness, material, width, length,
            categories, quantity, data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(
                query,
                data.get("name"),
                data.get("thickness"),
                data.get("material"),
                data.get("width"),
                data.get("length"),
                data.get("categories", []),
                data.get("quantity", 0),
                json.dumps(data),
            )

    @ensure_connection
    async def get_sheet_id(self, sheet_name: str) -> int:
        query = f"SELECT id FROM {self.TABLE_NAME} WHERE name = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, sheet_name)
        return row["id"] if row else -1

    @ensure_connection
    async def update_sheet(self, sheet_id: int, new_data: dict, modified_by: str):
        if sheet_id < 0:
            sheet_id = await self.get_sheet_id(new_data["name"])
            new_data["id"] = sheet_id

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                # Fetch current row
                current_row = await conn.fetchrow(f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", sheet_id)
                current_json = json.loads(current_row["data"])
                new_json = new_data.copy()

                if current_json != new_json:
                    task = asyncio.create_task(self.sheets_history_db.insert_history_item(sheet_id, new_data, modified_by))
                    task.add_done_callback(lambda t: logging.error("Unhandled task error", exc_info=t.exception()) if t.exception() else None)
            # Update the main row
            await conn.fetchval(
                f"""
                UPDATE {self.TABLE_NAME} SET
                    name = $2, thickness = $3, material = $4, width = $5,
                    length = $6, categories = $7, quantity = $8, data = $9,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 RETURNING id;
                """,
                sheet_id,
                new_data.get("name"),
                new_data.get("thickness"),
                new_data.get("material"),
                new_data.get("width"),
                new_data.get("length"),
                new_data.get("categories", []),
                new_data.get("quantity", 0),
                json.dumps(new_data),
            )
        # Invalidate caches
        self.cache_manager.invalidate(f"sheet_{sheet_id}")
        self.cache_manager.invalidate("all_sheets")

    @ensure_connection
    async def delete_sheet(self, sheet_id: int | str) -> bool:
        query = f"DELETE FROM {self.TABLE_NAME} WHERE id = $1 RETURNING id" if isinstance(sheet_id, int) else f"DELETE FROM {self.TABLE_NAME} WHERE name = $1 RETURNING id"
        async with self.db_pool.acquire() as conn:
            deleted_id = await conn.fetchval(query, sheet_id)

        self.cache_manager.invalidate(f"sheet_{sheet_id}")
        self.cache_manager.invalidate("all_sheets")
        return deleted_id is not None

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
        await self.cache_manager.shutdown()
