import logging

import asyncpg
import bcrypt
from asyncpg import Pool

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class UsersDB(BaseWithDBPool):
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
                await self._create_table_if_not_exists()
            except asyncpg.exceptions.PostgresError as e:
                logging.error(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        query = """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role_id INTEGER NOT NULL REFERENCES roles(id),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def list_users(self):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, name, role FROM users ORDER BY id")
            return [{"id": r["id"], "name": r["name"], "role": r["role"]} for r in rows]

    @ensure_connection
    async def add_user(self, name: str, password: str, role: str):
        hashed = self.hash_password(password)
        async with self.db_pool.acquire() as conn:
            role_id = await conn.fetchval("SELECT id FROM roles WHERE name = $1", role)
            if role_id is None:
                raise ValueError("Invalid role name")
            await conn.execute(
                """
                INSERT INTO users (name, password_hash, role_id)
                VALUES ($1, $2, $3)
                """,
                name,
                hashed,
                role_id,
            )

    def hash_password(self, password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def verify_password(self, password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode(), hashed.encode())

    @ensure_connection
    async def update_user(self, user_id: int, name: str | None = None, password: str | None = None, role: str | None = None):
        fields = []
        values = []
        if name:
            fields.append("name = $%d" % (len(values) + 1))
            values.append(name)
        if password:
            fields.append("password_hash = $%d" % (len(values) + 1))
            values.append(self.hash_password(password))
        if role:
            fields.append("role = $%d" % (len(values) + 1))
            values.append(role)
        if not fields:
            return
        values.append(user_id)
        await self.db_pool.execute(
            f"""
            UPDATE users SET {", ".join(fields)}, updated_at = now()
            WHERE id = ${len(values)}
        """,
            *values,
        )

    @ensure_connection
    async def delete_user(self, user_id: int):
        async with self.db_pool.acquire() as conn:
            await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    @ensure_connection
    async def get_user(self, user_id: int):
        async with self.db_pool.acquire() as conn:
            return await conn.fetchrow(
                """
                SELECT
                    users.id,
                    users.name,
                    roles.name AS role,
                    roles.permissions
                FROM users
                JOIN roles ON users.role_id = roles.id
                WHERE users.id = $1
                """,
                user_id,
            )

    @ensure_connection
    async def authenticate_user(self, name: str, password: str):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT id, password_hash FROM users WHERE name = $1", name)
            if row and self.verify_password(password, row["password_hash"]):
                return row["id"]
            return None
