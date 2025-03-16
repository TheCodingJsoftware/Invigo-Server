import os
import json
import asyncpg
from typing import Literal
from dotenv import load_dotenv

from utils.workspace.job import Job
from utils.workspace.assembly import Assembly
from utils.inventory.nest import Nest

import functools

def ensure_connection(func):
    """Decorator to ensure the database connection is active before executing a query."""
    @functools.wraps(func)
    async def wrapper(self: "WorkspaceDB", *args, **kwargs):
        if self.db_pool is None or self.db_pool._closed:
            print("Reconnecting to database...")
            await self.connect()
        return await func(self, *args, **kwargs)
    return wrapper


class WorkspaceDB:
    def __init__(self):
        """Initialize the async database connection."""
        self.db_pool = None
        load_dotenv()

    async def connect(self):
        """Create an async connection pool with automatic reconnection."""
        if self.db_pool is None or self.db_pool._closed:  # Check if the pool is closed
            try:
                self.db_pool = await asyncpg.create_pool(
                    user=os.getenv("POSTGRES_USER"),
                    password=os.getenv("POSTGRES_PASSWORD"),
                    database=os.getenv("POSTGRES_DB"),
                    host=os.getenv("POSTGRES_HOST"),
                    port=os.getenv("POSTGRES_PORT"),
                    min_size=1,
                    max_size=5,
                    timeout=60,
                    command_timeout=60,
                    max_inactive_connection_lifetime=60,
                )
                await self._create_table_if_not_exists()
            except asyncpg.exceptions.PostgresError as e:
                print(f"Database connection error: {e}")
                self.db_pool = None

    @ensure_connection
    async def _create_table_if_not_exists(self):
        """Creates the workspace table if it does not exist."""
        query = """
        CREATE TABLE IF NOT EXISTS workspace (
            id SERIAL PRIMARY KEY,
            parent_id INT REFERENCES workspace(id) ON DELETE CASCADE,
            type TEXT CHECK (type IN ('job', 'nest', 'assembly', 'laser_cut_part', 'component', 'structural_steel_part')),
            data JSONB NOT NULL
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    @ensure_connection
    async def get_all_jobs(self):
        """Retrieve all jobs from the workspace."""
        query = "SELECT * FROM workspace WHERE type = 'job'"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [dict(row) for row in rows]

    @ensure_connection
    async def get_job_by_id(self, job_id: int):
        """Retrieve a specific job and its related assemblies and parts."""
        async with self.db_pool.acquire() as conn:
            job_query = "SELECT * FROM workspace WHERE id = $1 AND type = 'job'"
            job_row = await conn.fetchrow(job_query, job_id)

            if not job_row:
                return None

            job_data = dict(job_row)
            job_data["data"] = json.loads(job_data["data"])  # Parse JSON data field

            # Recursively fetch all related assemblies and parts
            job_data["children"] = await self.get_children(conn, job_id)

        return job_data

    @ensure_connection
    async def get_children(self, conn, parent_id: int):
        """Recursively fetch all child assemblies and parts for a given parent."""
        child_query = "SELECT * FROM workspace WHERE parent_id = $1"
        child_rows = await conn.fetch(child_query, parent_id)

        children = []
        for row in child_rows:
            child_data = dict(row)
            child_data["data"] = json.loads(child_data["data"])  # Parse JSON data field

            # Recursively fetch sub-assemblies or parts
            child_data["children"] = await self.get_children(conn, child_data["id"])

            children.append(child_data)

        return children

    @ensure_connection
    async def add_job(self, job: Job):
        """ Adds a Job and its related assemblies, sub-assemblies, and parts recursively. """
        job_data = json.dumps(job.to_dict()['job_data'])  # Convert Job object to JSON
        job_id = await self._insert_entry(None, 'job', job_data)  # Insert the job first (root entry)

        # Insert Assemblies & Sub-assemblies recursively
        for assembly in job.assemblies:
            await self._insert_assembly_recursive(assembly, job_id)

        for nest in job.nests:
            await self._insert_nest(nest, job_id)

        return job_id  # Return the top-level job ID

    @ensure_connection
    async def delete_job(self, job_id: int):
        """Delete a job and its related assemblies, sub-assemblies, and parts recursively."""
        await self._delete_entry(job_id)

    async def _delete_entry(self, entry_id: int):
        query = """
        DELETE FROM workspace
        WHERE id = $1
        RETURNING id
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query, entry_id)

    @ensure_connection
    async def get_entry_by_id(self, entry_id: int) -> dict:
        """Retrieve a specific entry."""
        async with self.db_pool.acquire() as conn:
            entry_query = "SELECT * FROM workspace WHERE id = $1"
            entry_row = await conn.fetchrow(entry_query, entry_id)
            if not entry_row:
                return None
            entry_data = dict(entry_row)
        return entry_data

    async def update_entry(self, job_id: int, job_data: dict):
        """Update a job and its related assemblies, sub-assemblies, and parts recursively."""
        job_data = json.dumps(job_data)  # Convert Job object to JSON
        await self._update_entry(job_id, job_data)  # Update the job first (root entry)

    @ensure_connection
    async def _update_entry(self, entry_id: int, data):
        query = """
        UPDATE workspace
        SET data = $2
        WHERE id = $1
        RETURNING id
        """
        async with self.db_pool.acquire() as conn:
            new_id = await conn.fetchval(query, entry_id, data)
        return new_id

    async def _insert_entry(self, parent_id: int, entry_type: Literal['job', 'assembly', 'nest', 'laser_cut_part', 'component'], data):
        """Helper function to insert an entry into the workspace table."""
        query = """
        INSERT INTO workspace (parent_id, type, data)
        VALUES ($1, $2, $3)
        RETURNING id
        """
        async with self.db_pool.acquire() as conn:
            new_id = await conn.fetchval(query, parent_id, entry_type, data)
        return new_id

    async def _insert_nest(self, nest: Nest, parent_id: int):
        nest_data = json.dumps(nest.to_dict()['nest_data'])  # Convert Nest to JSON
        await self._insert_entry(parent_id, 'nest', nest_data)

    async def _insert_assembly_recursive(self, assembly: Assembly, parent_id: int):
        """ Recursively insert assemblies and their components/nested assemblies. """
        assembly_data = json.dumps(assembly.to_dict()['assembly_data'])  # Convert Assembly to JSON
        assembly_id = await self._insert_entry(parent_id, 'assembly', assembly_data)

        # Insert all laser-cut parts/components under this assembly
        for part in assembly.laser_cut_parts:
            part_data = json.dumps(part.to_dict())  # Convert Part to JSON
            await self._insert_entry(assembly_id, 'laser_cut_part', part_data)

        for component in assembly.components:
            component_data = json.dumps(component.to_dict())  # Convert Component to JSON
            await self._insert_entry(assembly_id, 'component', component_data)

        for structural_steel_part in assembly.structural_steel_components:
            structural_steel_part_data = json.dumps(structural_steel_part.to_dict())  # Convert StructuralSteelPart to JSON
            await self._insert_entry(assembly_id, 'structural_steel_part', structural_steel_part_data)

        # Recursively insert sub-assemblies
        for sub_assembly in assembly.get_sub_assemblies():
            await self._insert_assembly_recursive(sub_assembly, assembly_id)

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None
