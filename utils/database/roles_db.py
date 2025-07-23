import logging

import asyncpg
from asyncpg import Pool

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class RolesDB(BaseWithDBPool):
    def __init__(self):
        self.db_pool: Pool | None = None

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
                await self._create_tables_if_not_exist()
            except asyncpg.exceptions.PostgresError as e:
                logging.error(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_tables_if_not_exist(self):
        query = """
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                permissions TEXT[] NOT NULL DEFAULT '{}'
            )
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def get_all_roles(self) -> list[dict]:
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, name, permissions FROM roles ORDER BY id")
            return [{"id": r["id"], "name": r["name"], "permissions": r["permissions"]} for r in rows]

    @ensure_connection
    async def create_or_update_role(self, data: dict):
        role_id = data.get("id")
        name = data["name"]
        permissions = data.get("permissions", [])

        async with self.db_pool.acquire() as conn:
            if role_id:
                await conn.execute(
                    "UPDATE roles SET name = $1, permissions = $2 WHERE id = $3",
                    name,
                    permissions,
                    role_id,
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO roles (name, permissions)
                    VALUES ($1, $2)
                    ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions
                    """,
                    name,
                    permissions,
                )

    @ensure_connection
    async def delete_role(self, role_id: int):
        async with self.db_pool.acquire() as conn:
            await conn.execute("DELETE FROM roles WHERE id = $1", role_id)
