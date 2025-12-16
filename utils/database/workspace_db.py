import json
import logging
import os
import traceback
from datetime import datetime, timedelta
from typing import Any, Optional

import asyncpg
import msgspec
from asyncpg import Connection, Pool

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection


class WorkspaceDB(BaseWithDBPool):
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
                await self._create_table_if_not_exists()
            except asyncpg.exceptions.PostgresError as e:
                logging.error(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        sql_path = os.path.join(os.path.dirname(__file__), "workspace.sql")
        with open(sql_path, "r", encoding="utf-8") as f:
            query = f.read()

        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def insert_into_table(self, conn: Connection, table_name: str, data: dict[str, Any], return_column: Optional[str] = None):
        try:
            columns = list(data.keys())
            values = list(data.values())

            placeholders = ", ".join(f"${i}" for i in range(1, len(columns) + 1))

            query = f"""
            INSERT INTO {table_name} ({", ".join(columns)})
            VALUES ({placeholders})
            """

            if return_column:
                query += f" RETURNING {return_column}"
                return await conn.fetchval(query, *values)  # ✅ returns int, not dict
            else:
                await conn.execute(query, *values)

        except Exception as e:
            print(f"Error inserting into {table_name}: {e}")
            raise

    @ensure_connection
    async def add_job(self, job: dict):
        try:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    job_id = await self.insert_into_table(
                        conn,
                        "jobs",
                        {
                            "name": job["job_data"]["name"],
                            "job_data": json.dumps(job.get("job_data")),
                            "assemblies": json.dumps(job.get("assemblies")),
                            "nests": json.dumps(job.get("nests")),
                        },
                        return_column="id",
                    )

                    async def insert_assembly_group(assembly, parent_id=None):
                        for _ in range(int(assembly["meta_data"]["quantity"])):
                            this_assembly_id = await self.insert_into_table(
                                conn,
                                "assemblies",
                                {
                                    "job_id": job_id,
                                    "parent_id": parent_id,
                                    "name": assembly["name"],
                                    "flowtag": assembly["workspace_data"]["flowtag"]["tags"],
                                    "flowtag_index": 0,
                                    "flowtag_status_index": 0,
                                    "start_time": None,
                                    "end_time": None,
                                    "meta_data": json.dumps(assembly.get("meta_data")),
                                    "prices": json.dumps(assembly.get("prices")),
                                    "paint_data": json.dumps(assembly.get("paint_data")),
                                    "primer_data": json.dumps(assembly.get("primer_data")),
                                    "powder_data": json.dumps(assembly.get("powder_data")),
                                    "workspace_data": json.dumps(assembly.get("workspace_data")),
                                    "changed_by": "Part was added.",
                                },
                                return_column="id",
                            )

                            for part in assembly.get("laser_cut_parts", []):
                                for _ in range(int(part["inventory_data"]["quantity"])):
                                    await self.insert_into_table(
                                        conn,
                                        "assembly_laser_cut_parts",
                                        {
                                            "job_id": job_id,
                                            "assembly_id": this_assembly_id,
                                            "name": part["name"],
                                            "flowtag": part["workspace_data"]["flowtag"]["tags"],
                                            "flowtag_index": 0,
                                            "flowtag_status_index": 0,
                                            "recut": False,
                                            "recoat": False,
                                            "start_time": None,
                                            "end_time": None,
                                            "inventory_data": json.dumps(part.get("inventory_data")),
                                            "meta_data": json.dumps(part.get("meta_data")),
                                            "prices": json.dumps(part.get("prices")),
                                            "paint_data": json.dumps(part.get("paint_data")),
                                            "primer_data": json.dumps(part.get("primer_data")),
                                            "powder_data": json.dumps(part.get("powder_data")),
                                            "workspace_data": json.dumps(part.get("workspace_data")),
                                            "changed_by": "Part was added.",
                                        },
                                    )

                            for comp in assembly.get("components", []):
                                await self.insert_into_table(
                                    conn,
                                    "components",
                                    {
                                        "job_id": job_id,
                                        "assembly_id": this_assembly_id,
                                        "name": comp["part_name"],
                                        "quantity": int(comp["quantity"]),
                                        "data": json.dumps(comp),
                                    },
                                )
                            for sub in assembly.get("sub_assemblies", []):
                                await insert_assembly_group(sub, parent_id=this_assembly_id)

                    async def insert_nest(nest):
                        nest_id = await self.insert_into_table(
                            conn,
                            "nests",
                            {
                                "job_id": job_id,
                                "sheet": json.dumps(nest["sheet"]),
                                "laser_cut_parts": json.dumps(nest["laser_cut_parts"]),
                            },
                            return_column="id",
                        )
                        for part in nest["laser_cut_parts"]:
                            for _ in range(int(part["inventory_data"]["quantity"])):
                                await self.insert_into_table(
                                    conn,
                                    "nest_laser_cut_parts",
                                    {
                                        "job_id": job_id,
                                        "nest_id": nest_id,
                                        "name": part["name"],
                                        "start_time": None,
                                        "end_time": None,
                                        "inventory_data": json.dumps(part.get("inventory_data")),
                                        "meta_data": json.dumps(part.get("meta_data")),
                                        "prices": json.dumps(part.get("prices")),
                                        "paint_data": json.dumps(part.get("paint_data")),
                                        "primer_data": json.dumps(part.get("primer_data")),
                                        "powder_data": json.dumps(part.get("powder_data")),
                                        "workspace_data": json.dumps(part.get("workspace_data")),
                                        "changed_by": "Part was added.",
                                    },
                                )

                    for assembly in job.get("assemblies", []):
                        await insert_assembly_group(assembly)

                    for nest in job.get("nests", []):
                        await insert_nest(nest)

                    # await conn.execute("NOTIFY jobs, $1", msgspec.json.encode({"type": "job_created", "job_id": job_id}).decode())
                    await conn.execute(f"NOTIFY jobs, '{msgspec.json.encode({'type': 'job_created', 'job_id': job_id}).decode()}'")
                    return job_id
        except Exception as e:
            print(f"Error adding job: {e}")
            logging.error(f"Error adding job: {e}")
            raise e

    @ensure_connection
    async def get_all_jobs(self):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, name, job_data, created_at, modified_at FROM jobs")
            return [
                {
                    **dict(row),
                    "job_data": msgspec.json.decode(row["job_data"]),
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "modified_at": row["modified_at"].isoformat() if row["modified_at"] else None,
                }
                for row in rows
            ]

    @ensure_connection
    async def get_job_by_id(self, job_id):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, name, job_data, created_at, modified_at FROM jobs WHERE id = $1",
                job_id,
            )
            return {
                **dict(row),
                "job_data": msgspec.json.decode(row["job_data"]),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "modified_at": row["modified_at"].isoformat() if row["modified_at"] else None,
            }

    async def get_parts_by_job(self, job_id: int):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM assembly_laser_cut_parts
                WHERE assembly_laser_cut_parts.job_id = $1
                ORDER BY assembly_laser_cut_parts.id
                """,
                job_id,
            )
            return [dict(row) for row in rows]

    @ensure_connection
    async def get_grouped_part_by_id(self, part_id: int):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM assembly_laser_cut_parts WHERE id = $1",
                part_id,
            )
            return dict(row) if row else None

    @ensure_connection
    async def get_job_timeline(self, job_id: int | None):
        try:
            async with self.db_pool.acquire() as conn:
                params = []
                where_clause = ""
                if job_id:
                    where_clause = "WHERE id = $1"
                    params.append(job_id)

                # Fetch Jobs
                jobs_query = f"""
                    SELECT id, name, job_data, start_time, end_time, 'job' AS type
                    FROM jobs
                    {where_clause}
                """
                jobs = await conn.fetch(jobs_query, *params)

                def row_to_dict(row):
                    return {
                        "id": row["id"],
                        "name": row["name"],
                        "job_data": msgspec.json.decode(row["job_data"]),
                        "starting_date": row["start_time"],
                        "ending_date": row["end_time"],
                    }

                results = {}

                for job in jobs:
                    job_id = job["id"]
                    job_dict = row_to_dict(job)
                    results[str(job_id)] = job_dict
                return results

        except Exception as e:
            logging.error(f"Error in get_job_items_timelines: {e} {traceback.format_exc()}")
            raise e

    @ensure_connection
    async def save_job_flowtag_timeline(self, job_id: int, flowtag_timeline: str):
        async with self.db_pool.acquire() as conn:
            query = """
            UPDATE jobs
            SET job_data = jsonb_set(job_data, '{flowtag_timeline}', $2::jsonb, true)
            WHERE id = $1
            """
            await conn.execute(query, job_id, flowtag_timeline)
        await self.update_part_flowtag_dates(job_id, flowtag_timeline)

    @ensure_connection
    async def update_part_flowtag_dates(self, job_id: int, flowtag_timeline: str):
        flowtag_timeline: dict = msgspec.json.decode(flowtag_timeline)
        parsed_timeline = {
            tag: {
                "starting_date": datetime.fromisoformat(dates["starting_date"].replace("Z", "+00:00")) if dates.get("starting_date") else None,
                "ending_date": datetime.fromisoformat(dates["ending_date"].replace("Z", "+00:00")) if dates.get("ending_date") else None,
            }
            for tag, dates in flowtag_timeline.items()
        }
        async with self.db_pool.acquire() as conn:
            # fetch all parts for this job
            assemblies_query = """
                SELECT id, flowtag
                FROM assembly_laser_cut_parts
                WHERE job_id = $1
            """
            assemblies = await conn.fetch(assemblies_query, job_id)

            updates = []
            for assembly in assemblies:
                flowtags = assembly["flowtag"]
                start_dates = [parsed_timeline[tag]["starting_date"] for tag in flowtags if parsed_timeline.get(tag) and parsed_timeline[tag]["starting_date"]]
                end_dates = [parsed_timeline[tag]["ending_date"] for tag in flowtags if parsed_timeline.get(tag) and parsed_timeline[tag]["ending_date"]]

                if start_dates and end_dates:
                    min_start = min(start_dates)
                    max_end = max(end_dates)
                    updates.append((assembly["id"], min_start, max_end))

            update_query = """
                UPDATE assembly_laser_cut_parts
                SET start_time = $2,
                    end_time = $3,
                    modified_at = NOW()
                WHERE id = $1
            """
            await conn.executemany(update_query, updates)

        async with self.db_pool.acquire() as conn:
            # fetch all parts for this job
            assemblies_query = """
                SELECT id, flowtag
                FROM assemblies
                WHERE job_id = $1
            """
            assemblies = await conn.fetch(assemblies_query, job_id)

            updates = []
            for assembly in assemblies:
                flowtags = assembly["flowtag"]
                start_dates = [parsed_timeline[tag]["starting_date"] for tag in flowtags if parsed_timeline.get(tag) and parsed_timeline[tag]["starting_date"]]
                end_dates = [parsed_timeline[tag]["ending_date"] for tag in flowtags if parsed_timeline.get(tag) and parsed_timeline[tag]["ending_date"]]

                if start_dates and end_dates:
                    min_start = min(start_dates)
                    max_end = max(end_dates)
                    updates.append((assembly["id"], min_start, max_end))

            update_query = """
                UPDATE assemblies
                SET start_time = $2,
                    end_time = $3,
                    modified_at = NOW()
                WHERE id = $1
            """
            await conn.executemany(update_query, updates)

    @ensure_connection
    async def mark_workorder_parts_complete(
        self,
        parts: list[dict],
        changed_by: str,
    ) -> dict:
        overflow = []
        total_advanced = 0

        advance_sql = """
        WITH rows_to_advance AS (
            SELECT id
            FROM assembly_laser_cut_parts
            WHERE name = $1
              AND flowtag_index = 1
            ORDER BY id
            LIMIT $2
        )
        UPDATE assembly_laser_cut_parts p
        SET
            flowtag_index = flowtag_index + 1,
            flowtag_status_index = 0,
            is_timing = false,
            changed_by = $3,
            modified_at = now()
        FROM rows_to_advance r
        WHERE p.id = r.id
        RETURNING p.id;
        """

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                for part in parts:
                    rows = await conn.fetch(
                        advance_sql,
                        part["name"],
                        part["qty"],
                        changed_by,
                    )

                    advanced = len(rows)
                    total_advanced += advanced

                    if advanced < part["qty"]:
                        overflow.append(
                            {
                                "name": part["name"],
                                "requested": part["qty"],
                                "advanced": advanced,
                                "overflow": part["qty"] - advanced,
                            }
                        )

        return {
            "status": "ok",
            "advanced_total": total_advanced,
            "overflow": overflow,
        }
