import logging
import asyncpg
from asyncpg import Pool

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class SoftwareDB(BaseWithDBPool):
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
            CREATE TABLE IF NOT EXISTS software_versions (
                id BIGSERIAL PRIMARY KEY,
                version TEXT NOT NULL UNIQUE,
                file_path TEXT NOT NULL,
                changelog TEXT NOT NULL DEFAULT '',
                uploaded_by TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def get_latest_version(self):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT version, file_path, changelog, uploaded_by, created_at
                FROM software_versions
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            return dict(row) if row else None

    @ensure_connection
    async def add_version(
        self,
        version: str,
        file_path: str,
        uploaded_by: str,
        changelog: str,
    ):
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO software_versions
                    (version, file_path, changelog, uploaded_by, created_at)
                VALUES
                    ($1, $2, $3, $4, now())
                ON CONFLICT (version) DO UPDATE
                SET
                    file_path = EXCLUDED.file_path,
                    changelog = EXCLUDED.changelog,
                    uploaded_by = EXCLUDED.uploaded_by,
                    created_at = now()
                """,
                version,
                file_path,
                changelog,
                uploaded_by,
            )


    @ensure_connection
    async def get_version(self, version: str):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT version, file_path
                FROM software_versions
                WHERE version = $1
                """,
                version,
            )
            return dict(row) if row else None
