import contextlib
import logging
import traceback
from datetime import timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import asyncpg
import msgspec
from asyncpg import Pool

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class ViewType(Enum):
    GROUPED_BY_JOB = "view_grouped_laser_cut_parts_by_job"
    GROUPED_GLOBAL = "view_grouped_laser_cut_parts_global"


class ViewDB(BaseWithDBPool):
    def __init__(self):
        self.db_pool: Pool | None = None
        self.cache = {}
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
                # await self._create_table_if_not_exists()
            except asyncpg.exceptions.PostgresError as e:
                logging.error(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def find(
        self,
        view_type: ViewType,
        job_id: Optional[int] = None,
        name: Optional[str] = None,
        flowtag: Optional[list[str]] = None,
        flowtag_index: Optional[int] = None,
        data_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        conditions = []
        params = []
        param_index = 1

        if job_id is not None and view_type == ViewType.GROUPED_BY_JOB:
            conditions.append(f"job_id = ${param_index}")
            params.append(job_id)
            param_index += 1

        if name is not None:
            conditions.append(f"name = ${param_index}")
            params.append(name)
            param_index += 1

        if flowtag is not None:
            conditions.append(f"flowtag = ${param_index}::text[]")
            params.append(flowtag)
            param_index += 1

        if flowtag_index is not None:
            conditions.append(f"flowtag_index = ${param_index}")
            params.append(flowtag_index)

        where_clause = " AND ".join(conditions)
        where_clause = f"WHERE {where_clause}" if where_clause else ""

        # If specific data type is requested, select only that column
        columns = data_type if data_type else "*"
        query = f"""
            SELECT {columns}
            FROM workspace_assembly_laser_cut_parts
            {where_clause}
            ORDER BY created_at DESC
            LIMIT 1
            """

        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, *params)  # Using fetchrow instead of fetch
                if row:
                    return row[data_type] if data_type else dict(row)
                return None
        except asyncpg.exceptions.PostgresError as e:
            logging.error(f"Database query error: {e}")
            raise

    @ensure_connection
    async def find_by_job(self, job_id: int, name: str, flowtag: Optional[list[str]], flowtag_index: Optional[int], data_type: Optional[str]) -> List[Dict[str, Any]]:
        """
        Convenience method to find parts by job ID
        """
        return await self.find(view_type=ViewType.GROUPED_BY_JOB, job_id=job_id, name=name, flowtag=flowtag, flowtag_index=flowtag_index, data_type=data_type)

    @ensure_connection
    async def find_global(self, name: str, flowtag: Optional[list[str]], flowtag_index: Optional[int], data_type: Optional[str]) -> List[Dict[str, Any]]:
        return await self.find(view_type=ViewType.GROUPED_GLOBAL, name=name, flowtag=flowtag, flowtag_index=flowtag_index, data_type=data_type)

    @ensure_connection
    async def update_flowtag_index_by_job(self, job_id: int, name: str, flowtag: list, flowtag_index: int, new_index: int) -> None:
        query = """
        UPDATE workspace_assembly_laser_cut_parts
        SET
        flowtag_index = $1,
        modified_at = NOW()
        WHERE
        job_id = $2
        AND name = $3
        AND flowtag = $4::text[]
        AND flowtag_index = $5
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, new_index, job_id, name, flowtag, flowtag_index)

    @ensure_connection
    async def update_flowtag_index_global(self, name: str, flowtag: list, flowtag_index: int, new_index: int) -> None:
        query = """
        UPDATE workspace_assembly_laser_cut_parts
        SET
        flowtag_index = $1,
        modified_at = NOW()
        WHERE
        name = $2
        AND flowtag = $3::text[]
        AND flowtag_index = $4
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, new_index, name, flowtag, flowtag_index)

    def decode_json_fields(self, row, fields=("meta_data", "workspace_data")):
        result = dict(row)
        for field in fields:
            if field in result and isinstance(result[field], str):
                with contextlib.suppress(msgspec.DecodeError):
                    result[field] = msgspec.json.decode(result[field])
        return result

    @ensure_connection
    async def get_grouped_parts_view(self, db_view: str, show_completed: int, viewable_tags: list[str]) -> list[dict]:
        if db_view not in {
            "view_grouped_laser_cut_parts_by_job",
            "view_grouped_laser_cut_parts_global",
        }:
            raise ValueError("Invalid view name")
        try:
            async with self.db_pool.acquire() as conn:
                where_clauses = []
                params = []

                if show_completed == 0:
                    where_clauses.append("is_completed = false")

                if viewable_tags:
                    where_clauses.append("current_flowtag = ANY($1::text[])")
                    params.append(viewable_tags)

                where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
                query = f"SELECT * FROM {db_view}{where_sql}"
                rows = await conn.fetch(query, *params)
                return [self.decode_json_fields(row) for row in rows]
        except Exception as e:
            logging.error(f"Error getting grouped parts view: {e} {traceback.format_exc()}")
            raise e
