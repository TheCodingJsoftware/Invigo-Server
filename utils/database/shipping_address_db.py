import asyncio
import logging
from typing import Optional

import asyncpg

from config.environments import Environment
from utils.database.shipping_addresses_history_db import ShippingAddressesHistoryDB
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class ShippingAddressesDB(BaseWithDBPool):
    TABLE_NAME = "shipping_addresses"

    def __init__(self):
        self.shipping_addresses_history_db = ShippingAddressesHistoryDB()
        self.db_pool = None

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
            address TEXT,
            phone TEXT,
            email TEXT,
            website TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def add_shipping_address(self, shipping_address: dict) -> int:
        query = f"""
        INSERT INTO {self.TABLE_NAME}
        (name, address, phone, email, website, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                shipping_address["name"],
                shipping_address["address"],
                shipping_address["phone"],
                shipping_address["email"],
                shipping_address["website"],
                shipping_address["notes"],
            )
        return row["id"]

    @ensure_connection
    async def save_shipping_address(self, shipping_address_id: int | str, new_data: dict, modified_by: str = "system"):
        if isinstance(shipping_address_id, str):
            # Optionally add name-based lookup if you want
            # shipping_address_id = await self.get_shipping_address_id_by_name(shipping_address_id)
            pass  # For now we assume numeric id

        shipping_address_does_not_exist = False

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                current_row = await conn.fetchrow(f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1", shipping_address_id)

                if current_row is None:
                    shipping_address_does_not_exist = True
                else:
                    # Insert history in background
                    task = asyncio.create_task(self.shipping_addresses_history_db.insert_history_shipping_address(shipping_address_id, new_data, modified_by))
                    task.add_done_callback(lambda t: logging.error("Unhandled task error", exc_info=t.exception()) if t.exception() else None)

                    await conn.execute(
                        f"""
                        UPDATE {self.TABLE_NAME} SET
                            name = $2,
                            address = $3,
                            phone = $4,
                            email = $5,
                            website = $6,
                            notes = $7,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                        """,
                        shipping_address_id,
                        new_data["name"],
                        new_data["address"],
                        new_data["phone"],
                        new_data["email"],
                        new_data["website"],
                        new_data["notes"],
                    )

        if shipping_address_does_not_exist:
            logging.info(f"[SaveshippingAddress] shipping_address ID {shipping_address_id} not found. Creating new shipping_address.")
            new_id = await self.add_shipping_address(new_data)
            await self.shipping_addresses_history_db.insert_history_shipping_address(new_id, new_data, modified_by)
            return new_id

        # Optionally invalidate shipping_address cache here if you have one
        # self._invalidate_cache(f"shipping_address_{shipping_address_id}")
        # self._invalidate_cache("all_shipping_addresses")
        return shipping_address_id

    @ensure_connection
    async def update_shipping_address(self, shipping_address: dict) -> None:
        query = f"""
        UPDATE {self.TABLE_NAME}
        SET name = $2,
            address = $3,
            phone = $4,
            email = $5,
            website = $6,
            notes = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                shipping_address["id"],
                shipping_address["name"],
                shipping_address["address"],
                shipping_address["phone"],
                shipping_address["email"],
                shipping_address["website"],
                shipping_address["notes"],
            )

    @ensure_connection
    async def get_shipping_address_by_id(self, shipping_address_id: int) -> Optional[dict]:
        query = f"SELECT * FROM {self.TABLE_NAME} WHERE id = $1;"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, shipping_address_id)

        return dict(row) if row else None

    @ensure_connection
    async def get_all_shipping_addresses(self) -> list[dict]:
        query = f"SELECT * FROM {self.TABLE_NAME} ORDER BY id;"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        return [dict(row) for row in rows]

    @ensure_connection
    async def delete_shipping_address(self, shipping_address_id: int) -> None:
        query = f"DELETE FROM {self.TABLE_NAME} WHERE id = $1;"
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, shipping_address_id)

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None
