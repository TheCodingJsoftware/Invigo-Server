import os
import json
import asyncpg
from typing import Literal
from dotenv import load_dotenv

from utils.workspace.job import Job
from utils.workspace.assembly import Assembly
from utils.inventory.nest import Nest


class WorkspaceDB:
    def __init__(self):
        """Initialize the async database connection."""
        self.db_pool = None
        load_dotenv()

    async def connect(self):
        """Create an async connection pool."""
        if self.db_pool is None:
            self.db_pool = await asyncpg.create_pool(
                user=os.getenv("POSTGRES_USER"),
                password=os.getenv("POSTGRES_PASSWORD"),
                database=os.getenv("POSTGRES_DB"),
                host=os.getenv("POSTGRES_HOST"),
                port=os.getenv("POSTGRES_PORT"),
            )
            await self._create_table_if_not_exists()

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

    async def get_all_jobs(self):
        """Retrieve all jobs from the workspace."""
        query = "SELECT * FROM workspace WHERE type = 'job'"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [dict(row) for row in rows]

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

        # for structural_steel_part in assembly.structural_steel_parts:
        #     structural_steel_part_data = json.dumps(structural_steel_part.to_dict())  # Convert StructuralSteelPart to JSON
        #     await self._insert_entry(assembly_id, 'structural_steel_part', structural_steel_part_data)

        # Recursively insert sub-assemblies
        for sub_assembly in assembly.get_sub_assemblies():
            await self._insert_assembly_recursive(sub_assembly, assembly_id)

    async def close(self):
        """Close the database connection pool."""
        if self.db_pool:
            await self.db_pool.close()
