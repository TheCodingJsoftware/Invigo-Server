import asyncio
import json
import logging
from typing import Literal

import asyncpg
from dotenv import load_dotenv

from config.environments import Environment
from utils.cache.inventory_cache_manager import InventoryCacheManager
from utils.database.item_history_db import ItemHistoryDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class LaserCutPartsInventoryDB(BaseWithDBPool):
    TABLE_NAME = "laser_cut_parts_inventory"

    def __init__(self):
        self.db_pool = None
        self.cache_manager = InventoryCacheManager(expiry_seconds=1)
        self.laser_cut_parts_history_db = ItemHistoryDB("laser_cut_part")
        load_dotenv()
        self.cache_manager.schedule_refresh(
            "all_laser_cut_parts", self.get_all_laser_cut_parts_no_cache, 60
        )
        self.cache_manager.schedule_refresh(
            "all_categories", self.get_categories_no_cache, 60
        )

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
            categories TEXT[],
            quantity FLOAT DEFAULT 0,
            recut BOOLEAN DEFAULT FALSE,
            recoat BOOLEAN DEFAULT FALSE,
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

        all_categories = sorted(
            {cat for row in rows if row["categories"] for cat in row["categories"]}
        )
        self.cache_manager.set(key, all_categories)
        return all_categories

    @ensure_connection
    async def get_categories_no_cache(self) -> list[str]:
        query = f"SELECT categories FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        all_categories = sorted(
            {cat for row in rows if row["categories"] for cat in row["categories"]}
        )
        return all_categories

    @ensure_connection
    async def get_recut_laser_cut_parts(self) -> list[dict]:
        return await self.get_laser_cut_parts_by_category("Recut")

    @ensure_connection
    async def get_laser_cut_parts_by_category(self, category: str) -> list[dict]:
        key = f"laser_cut_parts_category_{category.lower()}"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT data FROM {self.TABLE_NAME} WHERE $1 = ANY(categories)"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, category)

        laser_cut_parts = [json.loads(row["data"]) for row in rows]
        self.cache_manager.set(key, laser_cut_parts)
        return laser_cut_parts

    @ensure_connection
    async def get_laser_cut_part(self, laser_cut_part_id: int | str) -> dict | None:
        key = f"laser_cut_part_{laser_cut_part_id}"
        if cached := self.cache_manager.get(key):
            return cached

        query = (
            f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1"
            if isinstance(laser_cut_part_id, int)
            else f"SELECT * FROM {self.TABLE_NAME} WHERE part_number = $1"
        )
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, laser_cut_part_id)

        if row:
            json_data = json.loads(row["data"])
            json_data["id"] = row["id"]
            self.cache_manager.set(key, json_data)
            return json_data
        return None

    @ensure_connection
    async def get_laser_cut_part_no_cache(self, laser_cut_part_id: int) -> dict:
        query = f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, laser_cut_part_id)

        if row:
            json_data = json.loads(row["data"])
            json_data["id"] = row["id"]
            return json_data
        return None

    @ensure_connection
    async def laser_cut_part_exists(self, laser_cut_part_name: str) -> bool:
        query = f"SELECT 1 FROM {self.TABLE_NAME} WHERE part_number = $1"
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(query, laser_cut_part_name) is not None

    @ensure_connection
    async def get_all_laser_cut_parts(self) -> list[dict]:
        key = "all_laser_cut_parts"
        if cached := self.cache_manager.get(key):
            return cached

        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        laser_cut_parts = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            laser_cut_parts.append(json_data)
        self.cache_manager.set(key, laser_cut_parts)
        return laser_cut_parts

    @ensure_connection
    async def get_all_laser_cut_parts_no_cache(self) -> list[dict]:
        query = f"SELECT * FROM {self.TABLE_NAME}"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        laser_cut_parts = []
        for row in rows:
            row_dict = dict(row)
            json_data = json.loads(row_dict["data"])
            json_data["id"] = row_dict["id"]
            laser_cut_parts.append(json_data)

        return laser_cut_parts

    @ensure_connection
    async def add_laser_cut_part(self, data: dict):
        query = f"""
        INSERT INTO {self.TABLE_NAME} (
            part_name, categories, quantity, recut, recoat, data
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(
                query,
                data.get("name"),
                data.get("categories", []),
                data.get("quantity", 0),
                data.get("recut"),
                data.get("recoat"),
                json.dumps(data),
            )

    @ensure_connection
    async def get_laser_cut_part_id(self, laser_cut_part_name: str) -> int:
        query = f"SELECT id FROM {self.TABLE_NAME} WHERE part_name = $1"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, laser_cut_part_name)
        return row["id"] if row else -1

    @ensure_connection
    async def update_laser_cut_part(
        self, laser_cut_part_id: int, new_data: dict, modified_by: str = "system"
    ):
        if laser_cut_part_id < 0:
            laser_cut_part_id = await self.get_laser_cut_part_id(new_data["name"])
            new_data["id"] = laser_cut_part_id

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                # Fetch current row
                current_row = await conn.fetchrow(
                    f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1",
                    laser_cut_part_id,
                )
                current_json = json.loads(current_row["data"])
                new_json = new_data.copy()

                if current_json != new_json:
                    task = asyncio.create_task(
                        self.laser_cut_parts_history_db.insert_history_item(
                            laser_cut_part_id, new_data, modified_by
                        )
                    )
                    task.add_done_callback(
                        lambda t: logging.error(
                            "Unhandled task error", exc_info=t.exception()
                        )
                        if t.exception()
                        else None
                    )

                # Update the main row
                await conn.execute(
                    f"""
                    UPDATE {self.TABLE_NAME} SET
                        part_name = $2, categories = $3, quantity = $4, recut = $5, recoat = $6, data = $7,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    """,
                    laser_cut_part_id,
                    new_data.get("name"),
                    new_data.get("categories", []),
                    new_data.get("quantity", 0),
                    new_data.get("recut"),
                    new_data.get("recoat"),
                    json.dumps(new_data),
                )

        # Invalidate caches
        self.cache_manager.invalidate(f"laser_cut_part_{laser_cut_part_id}")
        self.cache_manager.invalidate("all_laser_cut_parts")

    @ensure_connection
    async def upsert_quantities(
        self,
        new_part_data: dict,
        operation: Literal["ADD", "SUBTRACT"] = "ADD",
        modified_by: str = "system",
    ):
        laser_cut_part_id = await self.get_laser_cut_part_id(new_part_data["name"])

        if laser_cut_part_id != -1:
            part_data = await self.get_laser_cut_part_no_cache(laser_cut_part_id)
            current_part_quantity = part_data.get("quantity", 0)
            new_part_quantity = new_part_data.get("quantity", 0)

            if operation == "ADD":
                new_quantity = new_part_quantity + current_part_quantity
            elif operation == "SUBTRACT":
                new_quantity = current_part_quantity - new_part_quantity
            else:
                raise ValueError(f"Invalid operation: {operation}")

            part_data["quantity"] = new_quantity

            # The part exists — update it (with history tracking)
            await self.update_laser_cut_part(
                laser_cut_part_id,
                part_data,
                modified_by=modified_by,
            )
            return laser_cut_part_id
        else:
            # The part does not exist — insert it
            part_id = await self.add_laser_cut_part(new_part_data)

            # Invalidate caches
            self.cache_manager.invalidate("all_laser_cut_parts")
            return part_id

    @ensure_connection
    async def delete_laser_cut_part(self, laser_cut_part_id: int | str) -> bool:
        query = (
            f"DELETE FROM {self.TABLE_NAME} WHERE id = $1 RETURNING id"
            if isinstance(laser_cut_part_id, int)
            else f"DELETE FROM {self.TABLE_NAME} WHERE part_name = $1 RETURNING id"
        )
        async with self.db_pool.acquire() as conn:
            deleted_id = await conn.fetchval(query, laser_cut_part_id)

        self.cache_manager.invalidate(f"laser_cut_part_{laser_cut_part_id}")
        self.cache_manager.invalidate("all_laser_cut_parts")
        return deleted_id is not None

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
        await self.cache_manager.shutdown()
