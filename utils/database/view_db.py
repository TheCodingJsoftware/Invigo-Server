import contextlib
import logging
import traceback
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import asyncpg
import msgspec
from asyncpg import Pool

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


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
                    database=Environment.POSTGRES_WORKSPACE_DB,
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
        job_id: Optional[int] = None,
        name: Optional[str] = None,
        flowtag: Optional[list[str]] = None,
        flowtag_index: Optional[int] = None,
        flowtag_status_index: Optional[int] = None,
        data_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        conditions = []
        params = []
        param_index = 1

        if job_id is not None:
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
            param_index += 1

        if flowtag_status_index is not None:
            conditions.append(f"flowtag_status_index = ${param_index}")
            params.append(flowtag_status_index)
            param_index += 1

        where_clause = " AND ".join(conditions)
        where_clause = f"WHERE {where_clause}" if where_clause else ""

        # If specific data type is requested, select only that column
        columns = data_type if data_type else "*"
        query = f"""
            SELECT {columns}
            FROM assembly_laser_cut_parts
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
    async def update_flowtag_index(
        self,
        new_index: int,
        name: str,
        flowtag: list,
        flowtag_index: int,
        flowtag_status_index: int,
        changed_by: str,
        user_id: int,
        job_id: int | None = None,
    ) -> None:
        base_query = """
        UPDATE assembly_laser_cut_parts
        SET
            flowtag_index = $1,
            flowtag_status_index = 0,
            recut = false,
            recoat = false,
            is_timing = false,
            changed_by = $6,
            modified_at = NOW()
        WHERE
            name = $2
            AND flowtag = $3::text[]
            AND flowtag_index = $4
            AND flowtag_status_index = $5
        """

        params = [
            new_index,
            name,
            flowtag,
            flowtag_index,
            flowtag_status_index,
            changed_by,
        ]

        if job_id is not None:
            base_query += " AND job_id = $7"
            params.append(job_id)

        async with self.db_pool.acquire() as conn:
            await conn.execute(base_query, *params)
            await self.log_workspace_event(
                conn,
                event_type="PROCESS_ADVANCED",
                description=f"{changed_by} advanced process for {name}",
                user_id=user_id,
                user_name=changed_by
            )

    @ensure_connection
    async def update_flowtag_status_index(
        self,
        name: str,
        flowtag: list,
        flowtag_index: int,
        flowtag_status_index: int,
        new_status_index: int,
        changed_by: str,
        user_id: int,
        job_id: int | None = None,
    ) -> None:
        query = """
        UPDATE assembly_laser_cut_parts
        SET
            flowtag_status_index = $1,
            changed_by = $6,
            modified_at = NOW()
        WHERE
            name = $2
            AND flowtag = $3::text[]
            AND flowtag_index = $4
            AND flowtag_status_index = $5
        """
        params = [
            new_status_index,
            name,
            flowtag,
            flowtag_index,
            flowtag_status_index,
            changed_by,
        ]

        if job_id is not None:
            query += " AND job_id = $7"
            params.append(job_id)

        async with self.db_pool.acquire() as conn:
            await conn.execute(query, *params)
            await self.log_workspace_event(
                conn,
                event_type="PROCESS_ADVANCED",
                description=f"{changed_by} updated process status for {name}",
                user_id=user_id,
                user_name=changed_by
            )

    @ensure_connection
    async def update_is_timing(
        self,
        name: str,
        flowtag: list,
        flowtag_index: int,
        flowtag_status_index: int,
        is_timing: bool,
        changed_by: str,
        user_id: int,
        job_id: int | None = None,
    ) -> None:
        query = """
        UPDATE assembly_laser_cut_parts
        SET
            is_timing = $1,
            changed_by = $6,
            modified_at = NOW()
        WHERE
            name = $2
            AND flowtag = $3::text[]
            AND flowtag_index = $4
            AND flowtag_status_index = $5
        """
        params = [
            is_timing,
            name,
            flowtag,
            flowtag_index,
            flowtag_status_index,
            changed_by,
        ]

        if job_id is not None:
            query += " AND job_id = $7"
            params.append(job_id)

        async with self.db_pool.acquire() as conn:
            await conn.execute(query, *params)
            await self.log_workspace_event(
                conn,
                event_type="TIMING_STARTED" if is_timing else "TIMING_STOPPED",
                description=f"{changed_by} {'started' if is_timing else 'stopped'} timing on '{name}'",
                user_id=user_id,
                user_name=changed_by,
            )

    @ensure_connection
    async def handle_recut(
        self,
        name: str,
        flowtag: list,
        flowtag_index: int,
        flowtag_status_index: int,
        recut_quantity: int,
        recut_reason: str,
        changed_by: str,
        user_id: int,
        job_id: int | None = None,
    ) -> None:
        where_clauses: list[str] = []
        params: list = []
        i = 1

        # SET values
        recut_param = i
        params.append(True)
        i += 1

        # WHERE clauses (built in order)
        if job_id is not None:
            where_clauses.append(f"job_id = ${i}")
            params.append(job_id)
            i += 1

        where_clauses.append(f"name = ${i}")
        params.append(name)
        i += 1

        where_clauses.append(f"flowtag = ${i}::text[]")
        params.append(flowtag)
        i += 1

        where_clauses.append(f"flowtag_index = ${i}")
        params.append(flowtag_index)
        i += 1

        where_clauses.append(f"flowtag_status_index = ${i}")
        params.append(flowtag_status_index)
        i += 1

        where_clauses.append("recut = false")

        # LIMIT
        limit_placeholder = f"${i}"
        params.append(recut_quantity)
        i += 1

        # changed_by
        changed_by_placeholder = f"${i}"
        params.append(changed_by)

        update_query = f"""
        WITH rows_to_update AS (
            SELECT id
            FROM assembly_laser_cut_parts
            WHERE {" AND ".join(where_clauses)}
            LIMIT {limit_placeholder}
        )
        UPDATE assembly_laser_cut_parts AS w
        SET
            recut = ${recut_param},
            flowtag_index = 0,
            flowtag_status_index = 0,
            is_timing = false,
            changed_by = {changed_by_placeholder},
            modified_at = NOW()
        FROM rows_to_update r
        WHERE w.id = r.id
        RETURNING w.*;
        """

        insert_query = """
        INSERT INTO recut_laser_cut_parts
            (name, flowtag, recut_reason, inventory_data, meta_data, prices,
            paint_data, primer_data, powder_data, workspace_data, changed_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
        """
        try:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    updated_parts = await conn.fetch(update_query, *params)

                    await self.log_workspace_event(
                        conn,
                        event_type="RECUT_SET",
                        description=f"{changed_by} recut {recut_quantity} parts",
                        user_id=user_id,
                        user_name=changed_by,
                    )

                    if not updated_parts:
                        return

                    await conn.executemany(
                        insert_query,
                        [
                            (
                                part["name"],
                                part["flowtag"],
                                recut_reason,
                                part["inventory_data"],
                                part["meta_data"],
                                part["prices"],
                                part["paint_data"],
                                part["primer_data"],
                                part["powder_data"],
                                part["workspace_data"],
                                changed_by,
                            )
                            for part in updated_parts
                        ],
                    )
        except Exception as e:
            print(e)
            print(traceback.format_exc())

    @ensure_connection
    async def handle_recut_finished(
        self,
        name: str,
        flowtag: list,
        flowtag_index: int,
        flowtag_status_index: int,
        changed_by: str,
        user_id: int,
        job_id: int | None = None,
    ) -> None:
        base_query = """
        UPDATE assembly_laser_cut_parts
        SET
            flowtag_index = $1,
            flowtag_status_index = 0,
            recut = false,
            is_timing = false,
            changed_by = $6,
            modified_at = NOW()
        WHERE
            name = $2
            AND flowtag = $3::text[]
            AND flowtag_index = $4
            AND flowtag_status_index = $5
        """

        params = [
            flowtag_index + 1,
            name,
            flowtag,
            flowtag_index,
            flowtag_status_index,
            changed_by,
        ]

        if job_id is not None:
            base_query += " AND job_id = $7"
            params.append(job_id)

        async with self.db_pool.acquire() as conn:
            await conn.execute(base_query, *params)

            await self.log_workspace_event(
                conn,
                event_type="RECUT_CLEARED",
                description=f"{changed_by} finished recut for {name}",
                user_id=user_id,
                user_name=changed_by,
            )

    def decode_json_fields(self, row, fields=("meta_data", "workspace_data")):
        result = dict(row)
        for field in fields:
            if field in result and isinstance(result[field], str):
                with contextlib.suppress(msgspec.DecodeError):
                    result[field] = msgspec.json.decode(result[field])
        return result

    @ensure_connection
    async def get_parts_view(self, show_completed: int, viewable_tags: list[str], start_date: str | None, end_date: str | None) -> list[dict]:
        def parse_iso_date(date_str: str) -> datetime:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))

        try:
            async with self.db_pool.acquire() as conn:
                where_clauses = []
                params = []

                if show_completed == 0:
                    where_clauses.append("is_completed = false")

                if viewable_tags:
                    if show_completed:
                        where_clauses.append("(current_flowtag IS NULL OR current_flowtag = ANY($1::text[]))")
                    else:
                        where_clauses.append("current_flowtag = ANY($1::text[])")
                    params.append(viewable_tags)

                # Date filtering logic: overdue items ignore date filters
                if start_date and end_date:
                    start_dt = parse_iso_date(start_date) if isinstance(start_date, str) else start_date
                    end_dt = parse_iso_date(end_date) if isinstance(end_date, str) else end_date

                    # Show items that are EITHER:
                    # 1. Overdue (ignore date range completely), OR
                    # 2. Not overdue but within the date range
                    date_condition = f"(is_overdue = true OR (is_overdue = false AND start_time <= ${len(params) + 1} AND end_time >= ${len(params) + 2}))"
                    where_clauses.append(date_condition)
                    params.extend([end_dt, start_dt])

                where_sql = " AND ".join(where_clauses) if where_clauses else ""
                query = f"SELECT * FROM view_grouped_laser_cut_parts_by_job"
                if where_sql:
                    query += f" WHERE {where_sql}"

                rows = await conn.fetch(query, *params)
                return [self.decode_json_fields(row) for row in rows]
        except Exception as e:
            logging.error(f"Error getting grouped parts view: {e} {traceback.format_exc()}")
            raise e

    async def log_workspace_event(
        self,
        conn: asyncpg.Connection,
        *,
        event_type: str,
        description: str,
        user_id: int,
        user_name: str
    ) -> None:
        await conn.execute(
            """
            INSERT INTO workspace_event_log
                (event_type, description, user_id, user_name)
            VALUES
                ($1, $2, $3, $4)
            """,
            event_type,
            description,
            user_id,
            user_name
        )