import asyncio
import json
import logging

import asyncpg
from dotenv import load_dotenv

from config.environments import Environment
from utils.cache.inventory_cache_manager import InventoryCacheManager
from utils.database.item_history_db import ItemHistoryDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class ComponentsInventoryDB(BaseWithDBPool):
    TABLE_NAME = "components_inventory"

    def __init__(self):
        self.db_pool = None
        self.cache_manager = InventoryCacheManager(expiry_seconds=1)
        self.components_history_db = ItemHistoryDB("component")
        load_dotenv()
        self.cache_manager.schedule_refresh("all_components", self.get_all_components_no_cache, 60)
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
            part_name TEXT NOT NULL,
            part_number TEXT NOT NULL,
            categories TEXT[],
            quantity FLOAT DEFAULT 0,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        if self.db_pool:
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
    async def get_components_by_category(self, category: str) -> list[dict]:
        key = f"components_category_{category.lower()}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT data FROM {self.TABLE_NAME} WHERE $1 = ANY(categories)"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, category)

        components = [json.loads(row["data"]) for row in rows]
        self.cache_manager.set(key, components)
        return components

    @ensure_connection
    async def get_component(self, component_id: int | str) -> dict | None:
        key = f"component_{component_id}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1" if isinstance(component_id, int) else f"SELECT * FROM {self.TABLE_NAME} WHERE part_number = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, component_id)

        if row:
            json_data = json.loads(row["data"])
            json_data["id"] = row["id"]
            self.cache_manager.set(key, json_data)
            return json_data
        return None

    @ensure_connection
    async def component_exists(self, component_name: str) -> bool:
        query = f"SELECT 1 FROM {self.TABLE_NAME} WHERE part_number = $1"
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(query, component_name) is not None

    @ensure_connection
    async def get_all_components(self) -> list[dict]:
        key = "all_components"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        components = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            components.append(json_data)
        self.cache_manager.set(key, components)
        return components

    @ensure_connection
    async def get_all_components_no_cache(self) -> list[dict]:
        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        components = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            components.append(json_data)

        return components

    @ensure_connection
    async def add_component(self, data: dict) -> int:
        query = f"""
        INSERT INTO {self.TABLE_NAME} (
            part_name, part_number,
            categories, quantity, data
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
        """
        self.cache_manager.invalidate("all_components")
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(
                query,
                data.get("part_name"),
                data.get("part_number"),
                data.get("categories", []),
                data.get("quantity", 0),
                json.dumps(data),
            )

    @ensure_connection
    async def get_component_id(self, component_name: str) -> int:
        async with self.db_pool.acquire() as conn:
            # Try part_name first
            query = f"SELECT id FROM {self.TABLE_NAME} WHERE part_name = $1"
            row = await conn.fetchrow(query, component_name)
            if row:
                return row["id"]

            # Try part_number next
            query = f"SELECT id FROM {self.TABLE_NAME} WHERE part_number = $1"
            row = await conn.fetchrow(query, component_name)
            if row:
                return row["id"]

        return -1

    @ensure_connection
    async def update_component(self, component_id: int, new_data: dict, modified_by: str = "system"):
        if component_id < 0:
            component_id = await self.get_component_id(new_data["part_number"])
            new_data["id"] = component_id

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                # Fetch current row
                current_row = await conn.fetchrow(f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", component_id)
                current_json = json.loads(current_row["data"])
                new_json = new_data.copy()

                if current_json != new_json:
                    task = asyncio.create_task(self.components_history_db.insert_history_item(component_id, new_data, modified_by))
                    task.add_done_callback(lambda t: logging.error("Unhandled task error", exc_info=t.exception()) if t.exception() else None)

                # Update the main row
                await conn.execute(
                    f"""
                    UPDATE {self.TABLE_NAME} SET
                        part_name = $2, part_number = $3, categories = $4, quantity = $5, data = $6,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    """,
                    component_id,
                    new_data.get("part_name"),
                    new_data.get("part_number"),
                    new_data.get("categories", []),
                    new_data.get("quantity", 0),
                    json.dumps(new_data),
                )

        # Invalidate caches
        self.cache_manager.invalidate(f"component_{component_id}")
        self.cache_manager.invalidate("all_components")

    @ensure_connection
    async def delete_component(self, component_id: int | str) -> bool:
        query = (
            f"DELETE FROM {self.TABLE_NAME} WHERE id = $1 RETURNING id" if isinstance(component_id, int) else f"DELETE FROM {self.TABLE_NAME} WHERE part_number = $1 RETURNING id"
        )
        async with self.db_pool.acquire() as conn:
            deleted_id = await conn.fetchval(query, component_id)

        self.cache_manager.invalidate(f"component_{component_id}")
        self.cache_manager.invalidate("all_components")
        return deleted_id is not None

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
        await self.cache_manager.shutdown()
