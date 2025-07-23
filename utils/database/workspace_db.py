import json
import logging
from datetime import timedelta

import asyncpg
import msgspec
from asyncpg import Pool

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
        query = """
        CREATE TABLE IF NOT EXISTS workspace_jobs (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            job_data JSONB,
            assemblies JSONB,
            nests JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS workspace_nests (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
            data JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS workspace_grouped_assemblies (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
            parent_id INTEGER REFERENCES workspace_grouped_assemblies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            flowtag TEXT[] NOT NULL,
            flowtag_index INTEGER NOT NULL DEFAULT 0,
            setup_time JSONB,
            setup_time_seconds INTEGER,
            process_time JSONB,
            process_time_seconds INTEGER,
            automated_time JSONB,
            automated_time_seconds INTEGER,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            meta_data JSONB,
            prices JSONB,
            paint_data JSONB,
            primer_data JSONB,
            powder_data JSONB,
            workspace_data JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS workspace_assemblies (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
            parent_id INTEGER REFERENCES workspace_assemblies(id) ON DELETE CASCADE,
            group_id INTEGER REFERENCES workspace_grouped_assemblies(id),
            name TEXT NOT NULL,
            flowtag TEXT[] NOT NULL,
            flowtag_index INTEGER NOT NULL DEFAULT 0,
            setup_time JSONB,
            setup_time_seconds INTEGER,
            process_time JSONB,
            process_time_seconds INTEGER,
            automated_time JSONB,
            automated_time_seconds INTEGER,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            meta_data JSONB,
            prices JSONB,
            paint_data JSONB,
            primer_data JSONB,
            powder_data JSONB,
            workspace_data JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS workspace_grouped_laser_cut_parts (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
            assembly_group_id INTEGER REFERENCES workspace_grouped_assemblies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            flowtag TEXT[] NOT NULL,
            flowtag_index INTEGER NOT NULL DEFAULT 0,
            setup_time JSONB,
            setup_time_seconds INTEGER,
            process_time JSONB,
            process_time_seconds INTEGER,
            automated_time JSONB,
            automated_time_seconds INTEGER,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            meta_data JSONB,
            prices JSONB,
            paint_data JSONB,
            primer_data JSONB,
            powder_data JSONB,
            workspace_data JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS workspace_laser_cut_parts (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
            laser_cut_part_group_id INTEGER REFERENCES workspace_grouped_laser_cut_parts(id),
            name TEXT NOT NULL,
            flowtag TEXT[] NOT NULL,
            flowtag_index INTEGER NOT NULL DEFAULT 0,
            setup_time JSONB,
            setup_time_seconds INTEGER,
            process_time JSONB,
            process_time_seconds INTEGER,
            automated_time JSONB,
            automated_time_seconds INTEGER,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            inventory_data JSONB,
            meta_data JSONB,
            prices JSONB,
            paint_data JSONB,
            primer_data JSONB,
            powder_data JSONB,
            workspace_data JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS workspace_components (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
            assembly_id INTEGER REFERENCES workspace_grouped_assemblies(id),
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            data JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            modified_at TIMESTAMPTZ DEFAULT now()
        );

        -- Notify function for workspace_jobs
        CREATE OR REPLACE FUNCTION notify_job_change() RETURNS trigger AS $$
        BEGIN
        PERFORM pg_notify(
            'workspace_jobs',
            json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'job_id', COALESCE(NEW.id, OLD.id)
            )::text
        );
        RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;

        -- Trigger for workspace_jobs
        CREATE OR REPLACE TRIGGER job_event_trigger
        AFTER INSERT OR UPDATE OR DELETE ON workspace_jobs
        FOR EACH ROW EXECUTE FUNCTION notify_job_change();


        -- Notify function for workspace_grouped_laser_cut_parts
        CREATE OR REPLACE FUNCTION notify_part_change() RETURNS trigger AS $$
        DECLARE
            delta jsonb := '{}'::jsonb;
            key text;
        BEGIN
            -- Only build delta for updates
            IF TG_OP = 'UPDATE' THEN
                FOR key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
                    IF to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key THEN
                        delta := delta || jsonb_build_object(key, to_jsonb(NEW)->key);
                    END IF;
                END LOOP;
            ELSE
                delta := to_jsonb(COALESCE(NEW, OLD));
            END IF;

            PERFORM pg_notify(
                'workspace_grouped_laser_cut_parts',
                json_build_object(
                    'type', TG_OP,
                    'id', COALESCE(NEW.id, OLD.id),
                    'job_id', COALESCE(NEW.job_id, OLD.job_id),
                    'delta', delta
                )::text
            );
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;

        -- Trigger for workspace_grouped_laser_cut_parts
        CREATE OR REPLACE TRIGGER part_event_trigger
        AFTER INSERT OR UPDATE OR DELETE ON workspace_grouped_laser_cut_parts
        FOR EACH ROW EXECUTE FUNCTION notify_part_change();
        """

        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def add_job(self, job: dict):
        try:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    job_id = await conn.fetchval(
                        """
                        INSERT INTO workspace_jobs (name, job_data, assemblies, nests)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id
                        """,
                        job["job_data"]["name"],
                        json.dumps(job.get("job_data")),
                        json.dumps(job.get("assemblies")),
                        json.dumps(job.get("nests")),
                    )

                    grouped_assembly_ids = {}

                    async def insert_assembly_group(assembly, parent_id=None):
                        result = await conn.fetchrow(
                            """
                            INSERT INTO workspace_grouped_assemblies
                            (job_id, parent_id, name, quantity, flowtag, flowtag_index,
                            setup_time, setup_time_seconds, process_time, process_time_seconds,
                            automated_time, automated_time_seconds, start_time, end_time,
                            meta_data, prices, paint_data, primer_data, powder_data, workspace_data)
                            VALUES ($1,$2,$3,$4,$5,0,
                                    $6,$7,$8,$9,$10,$11,$12,$13,
                                    $14,$15,$16,$17,$18,$19)
                            RETURNING id
                            """,
                            job_id,
                            parent_id,
                            assembly["name"],
                            int(assembly["meta_data"]["quantity"]),
                            assembly["workspace_data"]["flowtag"]["tags"],
                            "{}",
                            0,
                            "{}",
                            0,
                            "{}",
                            0,
                            None,
                            None,
                            json.dumps(assembly.get("meta_data")),
                            json.dumps(assembly.get("prices")),
                            json.dumps(assembly.get("paint_data")),
                            json.dumps(assembly.get("primer_data")),
                            json.dumps(assembly.get("powder_data")),
                            json.dumps(assembly.get("workspace_data")),
                        )
                        group_id = result["id"]
                        grouped_assembly_ids[assembly["name"]] = group_id

                        for _ in range(int(assembly["meta_data"]["quantity"])):
                            await conn.execute(
                                """
                                INSERT INTO workspace_assemblies
                                (job_id, parent_id, group_id, name, flowtag, flowtag_index,
                                setup_time, setup_time_seconds, process_time, process_time_seconds,
                                automated_time, automated_time_seconds, start_time, end_time,
                                meta_data, prices, paint_data, primer_data, powder_data, workspace_data)
                                VALUES ($1,$2,$3,$4,$5,0,
                                        $6,0,$7,0,$8,0,$9,$10,
                                        $11,$12,$13,$14,$15,$16)
                                """,
                                job_id,
                                None,
                                group_id,
                                assembly["name"],
                                assembly["workspace_data"]["flowtag"]["tags"],
                                "{}",
                                "{}",
                                "{}",
                                None,
                                None,
                                json.dumps(assembly.get("meta_data")),
                                json.dumps(assembly.get("prices")),
                                json.dumps(assembly.get("paint_data")),
                                json.dumps(assembly.get("primer_data")),
                                json.dumps(assembly.get("powder_data")),
                                json.dumps(assembly.get("workspace_data")),
                            )

                        for part in assembly.get("laser_cut_parts", []):
                            part_group_id = await conn.fetchval(
                                """
                                INSERT INTO workspace_grouped_laser_cut_parts
                                (job_id, assembly_group_id, name, quantity, flowtag, flowtag_index,
                                setup_time, setup_time_seconds, process_time, process_time_seconds,
                                automated_time, automated_time_seconds, start_time, end_time,
                                meta_data, prices, paint_data, primer_data, powder_data, workspace_data)
                                VALUES ($1,$2,$3,$4,$5,0,
                                        $6,0,$7,0,$8,0,$9,$10,
                                        $11,$12,$13,$14,$15,$16)
                                RETURNING id
                                """,
                                job_id,
                                group_id,
                                part["name"],
                                int(part["inventory_data"]["quantity"]),
                                part["workspace_data"]["flowtag"]["tags"],
                                "{}",
                                "{}",
                                "{}",
                                None,
                                None,
                                json.dumps(part.get("meta_data")),
                                json.dumps(part.get("prices")),
                                json.dumps(part.get("paint_data")),
                                json.dumps(part.get("primer_data")),
                                json.dumps(part.get("powder_data")),
                                json.dumps(part.get("workspace_data")),
                            )

                            for _ in range(int(part["inventory_data"]["quantity"])):
                                await conn.execute(
                                    """
                                    INSERT INTO workspace_laser_cut_parts
                                    (job_id, laser_cut_part_group_id, name, flowtag, flowtag_index,
                                    setup_time, setup_time_seconds, process_time, process_time_seconds,
                                    automated_time, automated_time_seconds, start_time, end_time,
                                    inventory_data, meta_data, prices, paint_data, primer_data, powder_data, workspace_data)
                                    VALUES ($1,$2,$3,$4,0,
                                            $5,0,$6,0,$7,0,$8,$9,
                                            $10,$11,$12,$13,$14,$15,$16)
                                    """,
                                    job_id,
                                    part_group_id,
                                    part["name"],
                                    part["workspace_data"]["flowtag"]["tags"],
                                    "{}",
                                    "{}",
                                    "{}",
                                    None,
                                    None,
                                    json.dumps(part.get("inventory_data")),
                                    json.dumps(part.get("meta_data")),
                                    json.dumps(part.get("prices")),
                                    json.dumps(part.get("paint_data")),
                                    json.dumps(part.get("primer_data")),
                                    json.dumps(part.get("powder_data")),
                                    json.dumps(part.get("workspace_data")),
                                )

                        for comp in assembly.get("components", []):
                            await conn.execute(
                                """
                                INSERT INTO workspace_components
                                (job_id, assembly_id, name, quantity, data)
                                VALUES ($1, $2, $3, $4, $5)
                                """,
                                job_id,
                                group_id,
                                comp["part_name"],
                                int(comp["quantity"]),
                                json.dumps(comp),
                            )

                        for sub in assembly.get("sub_assemblies", []):
                            await insert_assembly_group(sub, parent_id=group_id)

                    for assembly in job.get("assemblies", []):
                        await insert_assembly_group(assembly)

                    await conn.execute("NOTIFY workspace_jobs, $1", msgspec.json.encode({"type": "job_created", "job_id": job_id}).decode())
                    return job_id
        except Exception as e:
            logging.error(f"Error adding job: {e}")
            self.write_error(f"Error adding job: {e}")
            self.set_status(500)
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
                SELECT * FROM workspace_grouped_laser_cut_parts
                WHERE workspace_grouped_laser_cut_parts.job_id = $1
                ORDER BY workspace_grouped_laser_cut_parts.id
                """,
                job_id,
            )
            return [dict(row) for row in rows]
