import json
import logging
import os
from datetime import timedelta
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
                        "workspace_jobs",
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
                                "workspace_assemblies",
                                {
                                    "job_id": job_id,
                                    "parent_id": parent_id,
                                    "name": assembly["name"],
                                    "flowtag": assembly["workspace_data"]["flowtag"]["tags"],
                                    "flowtag_index": 0,
                                    "flowtag_status_index": 0,
                                    "setup_time": "{}",
                                    "setup_time_seconds": 0,
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
                                        "workspace_assembly_laser_cut_parts",
                                        {
                                            "job_id": job_id,
                                            "assembly_id": this_assembly_id,
                                            "name": part["name"],
                                            "flowtag": part["workspace_data"]["flowtag"]["tags"],
                                            "flowtag_index": 0,
                                            "flowtag_status_index": 0,
                                            "recut": False,
                                            "recoat": False,
                                            "setup_time": "{}",
                                            "setup_time_seconds": 0,
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
                                    "workspace_components",
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
                            "workspace_nests",
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
                                    "workspace_nest_laser_cut_parts",
                                    {
                                        "job_id": job_id,
                                        "nest_id": nest_id,
                                        "name": part["name"],
                                        "setup_time": "{}",
                                        "setup_time_seconds": 0,
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

                    # await conn.execute("NOTIFY workspace_jobs, $1", msgspec.json.encode({"type": "job_created", "job_id": job_id}).decode())
                    await conn.execute(f"NOTIFY workspace_jobs, '{msgspec.json.encode({'type': 'job_created', 'job_id': job_id}).decode()}'")
                    return job_id
        except Exception as e:
            print(f"Error adding job: {e}")
            logging.error(f"Error adding job: {e}")
            raise e

    @ensure_connection
    async def get_all_jobs(self):
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, name, job_data, created_at, modified_at FROM workspace_jobs")
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
                "SELECT id, name, job_data, created_at, modified_at FROM workspace_jobs WHERE id = $1",
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
                SELECT * FROM workspace_assembly_laser_cut_parts
                WHERE workspace_assembly_laser_cut_parts.job_id = $1
                ORDER BY workspace_assembly_laser_cut_parts.id
                """,
                job_id,
            )
            return [dict(row) for row in rows]

    @ensure_connection
    async def get_grouped_part_by_id(self, part_id: int):
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM workspace_assembly_laser_cut_parts WHERE id = $1",
                part_id,
            )
            return dict(row) if row else None
