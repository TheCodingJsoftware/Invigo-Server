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
                    database=Environment.POSTGRES_WORKSPACE_DB,
                    host=Environment.POSTGRES_HOST,
                    port=Environment.POSTGRES_PORT,
                    min_size=Environment.POSTGRES_MIN_POOL_SIZE,
                    max_size=Environment.POSTGRES_MAX_POOL_SIZE,
                    timeout=Environment.POSTGRES_TIMEOUT,
                    command_timeout=Environment.POSTGRES_COMMAND_TIMEOUT,
                    max_inactive_connection_lifetime=Environment.POSTGRES_MAX_INACTIVE_CONNECTION_LIFETIME,
                )
                await self._create_table_if_not_exists()
                await self.ensure_default_admin()
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
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS user_roles (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, role_id)
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def ensure_default_admin(self):
        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                role_id = await conn.fetchval("SELECT id FROM roles WHERE name = 'Admin'")
                if not role_id:
                    role_id = await conn.fetchval(
                        """
                        INSERT INTO roles (name, permissions)
                        VALUES ($1, $2)
                        RETURNING id
                        """,
                        "Admin",
                        ["assign_roles", "edit_roles", "edit_users"],
                    )

                user_id = await conn.fetchval("SELECT id FROM users WHERE name = 'admin'")
                if not user_id:
                    password_hash = self.hash_password("admin")
                    user_id = await conn.fetchval(
                        "INSERT INTO users (name, password_hash) VALUES ($1, $2) RETURNING id",
                        "admin",
                        password_hash,
                    )

                has_role = await conn.fetchval(
                    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2",
                    user_id,
                    role_id,
                )
                if not has_role:
                    await conn.execute(
                        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                        user_id,
                        role_id,
                    )

    @ensure_connection
    async def list_users(self):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    u.id,
                    u.name,
                    ARRAY_AGG(DISTINCT r.name) AS roles,
                    ARRAY_AGG(DISTINCT p) AS permissions
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                LEFT JOIN LATERAL unnest(r.permissions) AS p ON true
                GROUP BY u.id, u.name
                ORDER BY u.id
                """
            )
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "roles": r["roles"],
                    "permissions": list(set(r["permissions"])),
                }
                for r in rows
            ]

    @ensure_connection
    async def add_user(self, name: str, password: str, role_names: list[str]):
        hashed = self.hash_password(password)
        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                user_id = await conn.fetchval(
                    "INSERT INTO users (name, password_hash) VALUES ($1, $2) RETURNING id",
                    name,
                    hashed,
                )
                for role_name in role_names:
                    role_id = await conn.fetchval("SELECT id FROM roles WHERE name = $1", role_name)
                    if role_id is None:
                        raise ValueError(f"Invalid role name: {role_name}")
                    await conn.execute(
                        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                        user_id,
                        role_id,
                    )

    def hash_password(self, password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def verify_password(self, password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode(), hashed.encode())

    @ensure_connection
    async def update_user(
        self,
        user_id: int,
        name: str | None = None,
        password: str | None = None,
        role_names: list[str] | None = None,
    ):
        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                fields = []
                values = []

                if name:
                    fields.append(f"name = ${len(values) + 1}")
                    values.append(name)

                if password:
                    fields.append(f"password_hash = ${len(values) + 1}")
                    values.append(self.hash_password(password))

                if fields:
                    values.append(user_id)
                    await conn.execute(
                        f"""
                        UPDATE users SET {", ".join(fields)}, updated_at = now()
                        WHERE id = ${len(values)}
                        """,
                        *values,
                    )

                if role_names is not None:
                    await conn.execute("DELETE FROM user_roles WHERE user_id = $1", user_id)
                    for role_name in role_names:
                        role_id = await conn.fetchval("SELECT id FROM roles WHERE name = $1", role_name)
                        if role_id is None:
                            raise ValueError(f"Invalid role: {role_name}")
                        await conn.execute(
                            "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                            user_id,
                            role_id,
                        )

    @ensure_connection
    async def delete_user(self, user_id: int):
        async with self.db_pool.acquire() as conn:
            await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    @ensure_connection
    async def get_user(self, user_id: int):
        async with self.db_pool.acquire() as conn:
            user_row = await conn.fetchrow("SELECT name FROM users WHERE id = $1", user_id)
            if not user_row:
                return None

            rows = await conn.fetch(
                """
                SELECT
                    roles.name AS role,
                    roles.permissions
                FROM user_roles
                JOIN roles ON user_roles.role_id = roles.id
                WHERE user_roles.user_id = $1
                """,
                user_id,
            )

            return {
                "id": user_id,
                "name": user_row["name"],
                "roles": [r["role"] for r in rows],
                "permissions": list({p for r in rows for p in r["permissions"]}),
            }

    @ensure_connection
    async def get_user_id_by_name(self, name: str) -> int | None:
        async with self.db_pool.acquire() as conn:
            return await conn.fetchval(
                "SELECT id FROM users WHERE name = $1",
                name,
            )

    @ensure_connection
    async def authenticate_user(self, name: str, password: str):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT id, password_hash FROM users WHERE name = $1", name)
            if row and self.verify_password(password, row["password_hash"]):
                return row["id"]
            return None
