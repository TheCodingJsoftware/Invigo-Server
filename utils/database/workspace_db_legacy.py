import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Literal

import asyncpg

from config.environments import Environment
from utils.decorators.connection import BaseWithDBPool, ensure_connection
from utils.inventory.nest import Nest
from utils.workspace.assembly import Assembly
from utils.workspace.job import Job


class WorkspaceDB(BaseWithDBPool):
    def __init__(self):
        self.db_pool = None
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
        CREATE TABLE IF NOT EXISTS workspace (
            id SERIAL PRIMARY KEY,
            parent_id INT REFERENCES workspace(id) ON DELETE SET NULL,
            type TEXT CHECK (type IN ('job', 'nest', 'assembly', 'laser_cut_part', 'component', 'structural_steel_part')),
            name TEXT,
            data JSONB NOT NULL
        );
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute(query)

    def _get_cache(self, key):
        if item := self.cache.get(key):
            value, timestamp = item
            if datetime.now() - timestamp < self.cache_expiry:
                return value
        return None

    def start_background_cache_worker(self):
        async def background_job():
            while not self._stop_background:
                try:
                    await self._warm_cache()
                except Exception as e:
                    logging.info(f"[CacheWorker] Error warming cache: {e}")
                await asyncio.sleep(Environment.WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL)

        # Only run once
        if self._background_task is None:
            self._background_task = asyncio.create_task(background_job())

    def stop_background_cache_worker(self):
        self._stop_background = True

    async def _warm_cache(self):
        if self._cache_refresh_queue:
            job_ids = list(self._cache_refresh_queue)
            self._cache_refresh_queue.clear()
            # print(f"[CacheWorker] Refreshing requested jobs: {job_ids}")
        else:
            job_ids = [job["id"] for job in await self.get_all_jobs()]
            # print("[CacheWorker] Full warm-up of all jobs.")

        warmed_jobs = 0
        part_name_sets = 0

        for job_id in job_ids:
            root = await self.get_job_by_id(job_id)
            if not root:
                continue

            # Traverse entire tree to find all part entries
            all_parts = self._flatten_job_parts(root)

            name_map = {}
            for entry in all_parts:
                name = entry.get("name")
                if name:
                    name_map.setdefault(name, []).append(entry)

            for name, entries in name_map.items():
                cache_key = f"job_{job_id}_name_{name}"
                self._set_cache(cache_key, entries)
                part_name_sets += 1

            warmed_jobs += 1

    async def warm_jobs_cache_by_ids(self, job_ids: list[int]):
        try:
            for job_id in job_ids:
                root = await self.get_job_by_id(job_id)
                if not root:
                    continue

                all_parts = self._flatten_job_parts(root)

                name_map: dict[str, list[dict]] = {}
                for entry in all_parts:
                    name = entry.get("name")
                    if name:
                        name_map.setdefault(name, []).append(entry)

                for name, entries in name_map.items():
                    cache_key = f"job_{job_id}_name_{name}"
                    self._set_cache(cache_key, entries)
        except Exception as e:
            logging.error(f"Error warming cache: {e}")

    def _flatten_job_parts(self, root_node):
        queue = [root_node]
        parts = []

        while queue:
            node = queue.pop()
            if node["type"] in {"laser_cut_part", "component", "structural_steel_part"}:
                parts.append(node)
            queue.extend(node.get("children", []))

        return parts

    def _set_cache(self, key, value):
        self.cache[key] = (value, datetime.now())

    def _invalidate_cache(self, key_startswith):
        self.cache = {k: v for k, v in self.cache.items() if not k.startswith(key_startswith)}

    @ensure_connection
    async def invalidate_entry_cache(self, entry_id: int):
        self._invalidate_cache(f"entry_{entry_id}")

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT id, parent_id, name FROM workspace WHERE id = $1", entry_id)
            if row:
                job_id = await self._find_root_job(conn, entry_id)
                name = row.get("name")
                if job_id and name:
                    self._invalidate_cache(f"job_{job_id}_name_{name}")
                if job_id:
                    self._invalidate_cache(f"job_{job_id}")
                    self._invalidate_cache("all_jobs")
                    self._cache_refresh_queue.add(job_id)

    async def _find_root_job(self, conn, entry_id: int) -> int | None:
        query = "SELECT id, parent_id, type FROM workspace WHERE id = $1"
        row = await conn.fetchrow(query, entry_id)
        if not row:
            return None
        if row["type"] == "job":
            return row["id"]
        elif row["parent_id"]:
            return await self._find_root_job(conn, row["parent_id"])
        return None

    @ensure_connection
    async def get_all_jobs(self):
        cache_key = "all_jobs"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        query = "SELECT * FROM workspace WHERE type = 'job'"
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)
        jobs = [dict(row) for row in rows]
        self._set_cache(cache_key, jobs)
        return jobs

    @ensure_connection
    async def get_job_by_id(self, job_id: int):
        cache_key = f"job_{job_id}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        async with self.db_pool.acquire() as conn:
            # Fetch full subtree in one query
            query = """
            WITH RECURSIVE subtree AS (
                SELECT * FROM workspace WHERE id = $1
                UNION ALL
                SELECT w.*
                FROM workspace w
                JOIN subtree s ON w.parent_id = s.id
            )
            SELECT * FROM subtree
            """
            rows = await conn.fetch(query, job_id)

        # Parse rows
        nodes = {}
        children_map: dict[str, list[str]] = {}

        for row in rows:
            entry = dict(row)
            entry["data"] = json.loads(entry["data"])
            entry["children"] = []
            nodes[entry["id"]] = entry

            if entry["parent_id"] is not None:
                children_map.setdefault(entry["parent_id"], []).append(entry["id"])

        # Reconstruct tree
        for parent_id, child_ids in children_map.items():
            parent = nodes[parent_id]
            for cid in child_ids:
                parent["children"].append(nodes[cid])

        root = nodes.get(job_id)
        self._set_cache(cache_key, root)
        return root

    async def get_cached_entries_by_name(self, job_id: int, name: str):
        cache_key = f"job_{job_id}_name_{name}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        # If not cached, query and set cache now
        entries = await self.get_entries_by_name(job_id, name)
        self._set_cache(cache_key, entries)
        return entries

    @ensure_connection
    async def get_entries_by_name(self, job_id: int, name: str) -> list[dict]:
        query = """
        WITH RECURSIVE subtree AS (
            SELECT * FROM workspace WHERE id = $1
            UNION ALL
            SELECT w.* FROM workspace w
            JOIN subtree s ON w.parent_id = s.id
        )
        SELECT * FROM subtree
        WHERE name = $2
        """
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, job_id, name)
        return [dict(row) for row in rows]

    @ensure_connection
    async def get_children(self, conn, parent_id: int, visited_ids=None):
        if visited_ids is None:
            visited_ids = set()

        if parent_id in visited_ids:
            return []

        visited_ids.add(parent_id)

        child_query = "SELECT * FROM workspace WHERE parent_id = $1"
        child_rows = await conn.fetch(child_query, parent_id)

        children = []
        for row in child_rows:
            child_data = dict(row)
            child_data["data"] = json.loads(child_data["data"])
            child_data["children"] = await self.get_children(conn, child_data["id"], visited_ids)
            children.append(child_data)

        return children

    def _extract_recut_parts_flat(self, root_node):
        recut_parts = []
        queue = [(root_node, [])]

        while queue:
            node, path = queue.pop(0)
            current_path = path + [f"{node['type']}:{node['id']}"]

            if node["type"] == "laser_cut_part" and node["data"].get("recut") is True:
                recut_parts.append(
                    {
                        "id": node["id"],
                        "type": node["type"],
                        "data": node["data"],
                        "path": current_path,
                    }
                )

            for child in node.get("children", []):
                queue.append((child, current_path))

        return recut_parts

    @ensure_connection
    async def get_all_recut_parts(self, job_id: int | None = None):
        results = []

        async with self.db_pool.acquire() as conn:
            if job_id:
                job_data = await self.get_job_by_id(job_id)
                results = self._extract_recut_parts_flat(job_data)
            else:
                all_jobs = await self.get_all_jobs()
                for job in all_jobs:
                    job_data = await self.get_job_by_id(job["id"])
                    results.extend(self._extract_recut_parts_flat(job_data))

        return results

    @ensure_connection
    async def add_job(self, job: Job):
        self._invalidate_cache("all_jobs")

        job_data = json.dumps(job.to_dict()["job_data"])

        async with self.db_pool.acquire() as conn:
            job_id = await self._insert_entry(conn, None, "job", job_data)

            self._invalidate_cache(f"job_{job_id}")

            await self._insert_assemblies_bulk(conn, job.assemblies, job_id)

            await self._insert_nests_bulk(conn, job.nests, job_id)

        return job_id

    @ensure_connection
    async def delete_job(self, job_id: int):
        self._invalidate_cache(f"job_{job_id}")
        self._invalidate_cache("all_jobs")
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
    async def get_entry_by_id(self, entry_id: int) -> dict | None:
        cache_key = f"entry_{entry_id}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        async with self.db_pool.acquire() as conn:
            entry_query = "SELECT * FROM workspace WHERE id = $1"
            entry_row = await conn.fetchrow(entry_query, entry_id)
            if not entry_row:
                return None
            entry_data = dict(entry_row)
            entry_data["data"] = json.loads(entry_data["data"])
            self._set_cache(cache_key, entry_data)
        return entry_data

    async def update_entry(self, entry_id: int, entry_data: dict):
        await self.invalidate_entry_cache(entry_id)
        serialized = json.dumps(entry_data)
        await self._update_entry(entry_id, serialized)

    @ensure_connection
    async def _update_entry(self, entry_id: int, data):
        name = None
        try:
            parsed = json.loads(data)
            name = parsed.get("name", None)
        except Exception:
            pass

        query = """
        UPDATE workspace
        SET name = $2, data = $3
        WHERE id = $1
        RETURNING id
        """
        async with self.db_pool.acquire() as conn:
            new_id = await conn.fetchval(query, entry_id, name, data)
        return new_id

    @ensure_connection
    async def find_root_jobs_bulk(self, entry_ids: list[int]) -> dict[int, int]:
        """
        Returns a mapping of entry_id -> root job_id
        """
        query = """
        WITH RECURSIVE trace(entry_id, id, parent_id, type, root_id) AS (
            SELECT id AS entry_id, id, parent_id, type, id AS root_id
            FROM workspace
            WHERE id = ANY($1::int[])

            UNION ALL

            SELECT t.entry_id, w.id, w.parent_id, w.type,
                CASE WHEN w.type = 'job' THEN w.id ELSE t.root_id END
            FROM workspace w
            JOIN trace t ON w.id = t.parent_id
        )
        SELECT entry_id, root_id
        FROM (
            SELECT entry_id, root_id,
                ROW_NUMBER() OVER (PARTITION BY entry_id ORDER BY id) AS rn
            FROM trace
            WHERE type = 'job'
        ) sub
        WHERE rn = 1
        """

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, entry_ids)

        return {row["entry_id"]: row["root_id"] for row in rows}

    async def invalidate_entries_cache_bulk(self, entry_ids: list[int]):
        # Invalidate entry-level cache
        for entry_id in entry_ids:
            self._invalidate_cache(f"entry_{entry_id}")

        root_map = await self.find_root_jobs_bulk(entry_ids)
        seen_roots = set()

        for root_id in root_map.values():
            if root_id and root_id not in seen_roots:
                self._invalidate_cache(f"job_{root_id}")
                self._cache_refresh_queue.add(root_id)
                seen_roots.add(root_id)

        self._invalidate_cache("all_jobs")

    @ensure_connection
    async def bulk_update_entries(self, updates: list[tuple[int, str]]) -> tuple[list[int], dict[int, set[str]]]:
        if not updates:
            return [], {}

        # Split into separate lists
        entry_ids, json_data = zip(*updates)

        # Extract names from the update payload
        names = []
        for data in json_data:
            try:
                parsed = json.loads(data)
                names.append(parsed.get("name", ""))
            except Exception:
                names.append("")

        # Stage 1: Perform the update and get updated entry IDs
        update_query = """
        UPDATE workspace AS w
        SET name = u.name, data = u.data::jsonb
        FROM (
            SELECT UNNEST($1::int[]) AS id,
                UNNEST($2::text[]) AS data,
                UNNEST($3::text[]) AS name
        ) AS u
        WHERE w.id = u.id
        RETURNING w.id, w.name
        """

        async with self.db_pool.acquire() as conn:
            update_rows = await conn.fetch(update_query, list(entry_ids), list(json_data), names)
            update_names = list({row["name"] for row in update_rows})
            updated_ids = list({row["id"] for row in update_rows})

            if not updated_ids:
                return [], {}

            entry_id_to_name = {row["id"]: row["name"] for row in update_rows}

            # Fetch root job IDs
            root_map = await self.find_root_jobs_bulk(updated_ids)

            # Build job_id -> set of names
            job_name_map: dict[int, list[str]] = {}
            for entry_id, name in entry_id_to_name.items():
                job_id = root_map.get(entry_id)
                if job_id is not None and name:
                    if job_id not in job_name_map:
                        job_name_map[job_id] = []
                    if name not in job_name_map[job_id]:
                        job_name_map[job_id].append(name)

        return updated_ids, job_name_map

    async def _bulk_insert_entries(self, conn, entries: list[tuple[int | None, str, str, str]]) -> list[int]:
        if not entries:
            return []  # ✅ Avoid unpacking error if no entries

        query = """
        INSERT INTO workspace (parent_id, type, name, data)
        SELECT x.parent_id, x.type, x.name, x.data::jsonb
        FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[]) AS x(parent_id, type, name, data)
        RETURNING id
        """

        try:
            parent_ids, types, names, datas = zip(*entries)  # ❗ This fails if list is empty or malformed
        except ValueError as e:
            logging.error(f"[bulk_insert_entries] Entry unpacking failed: {e} | Entries: {entries}")
            raise

        return await conn.fetch(query, list(parent_ids), list(types), list(names), list(datas))

    async def _insert_entry(
        self,
        conn,
        parent_id: int | None,
        entry_type: Literal[
            "job",
            "assembly",
            "nest",
            "laser_cut_part",
            "component",
            "structural_steel_part",
        ],
        data,
    ):
        name = None
        try:
            parsed = json.loads(data)
            name = parsed.get("name", None)
        except Exception:
            pass

        query = """
        INSERT INTO workspace (parent_id, type, name, data)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """

        new_id = await conn.fetchval(query, parent_id, entry_type, name, data)
        return new_id

    async def _insert_nests_bulk(self, conn, nests: list[Nest], parent_id: int):
        entries = [
            (
                parent_id,
                "nest",
                nest.to_dict()["nest_data"].get("name", ""),
                json.dumps(nest.to_dict()["nest_data"]),
            )
            for nest in nests
        ]
        await self._bulk_insert_entries(conn, entries)

    async def _insert_nest(self, conn, nest: Nest, parent_id: int):
        nest_data = json.dumps(nest.to_dict()["nest_data"])
        await self._insert_entry(conn, parent_id, "nest", nest_data)

    async def _insert_assemblies_bulk(self, conn, assemblies: list[Assembly], parent_id: int):
        all_entries: list[tuple[int, str, str, str]] = []

        def collect_entries(assembly: Assembly, parent: int):
            # Insert the assembly itself
            adata = assembly.to_dict()["assembly_data"]
            all_entries.append((parent, "assembly", adata.get("name", ""), json.dumps(adata)))

            for part in assembly.laser_cut_parts:
                pdata = part.to_dict()
                all_entries.append((None, "laser_cut_part", pdata.get("name", ""), json.dumps(pdata)))

            for comp in assembly.components:
                cdata = comp.to_dict()
                all_entries.append((None, "component", cdata.get("name", ""), json.dumps(cdata)))

            for steel in assembly.structural_steel_items:
                sdata = steel.to_dict()
                all_entries.append(
                    (
                        None,
                        "structural_steel_part",
                        sdata.get("name", ""),
                        json.dumps(sdata),
                    )
                )

            for sub in assembly.get_sub_assemblies():
                collect_entries(sub, None)  # We'll assign correct parent in future if needed

        for asm in assemblies:
            collect_entries(asm, parent_id)

        await self._bulk_insert_entries(conn, all_entries)

    async def _insert_assembly_recursive_bulk(self, conn, assembly: Assembly, parent_id: int):
        entries: list[tuple[int, str, str, str]] = []

        # Prepare the main assembly
        assembly_dict = assembly.to_dict()["assembly_data"]
        entries.append(
            (
                parent_id,
                "assembly",
                assembly_dict.get("name", ""),
                json.dumps(assembly_dict),
            )
        )

        # Flatten all sub-parts recursively first
        queue = [(assembly, None)]  # (assembly, temp_id)
        temp_children: list[tuple[int, str, str, str]] = []

        while queue:
            current_assembly, temp_parent = queue.pop(0)
            current_dict = current_assembly.to_dict()["assembly_data"]
            entries.append(
                (
                    parent_id,
                    "assembly",
                    current_dict.get("name", ""),
                    json.dumps(current_dict),
                )
            )

            for part in current_assembly.laser_cut_parts:
                d = part.to_dict()
                temp_children.append((None, "laser_cut_part", d.get("name", ""), json.dumps(d)))

            for component in current_assembly.components:
                d = component.to_dict()
                temp_children.append((None, "component", d.get("name", ""), json.dumps(d)))

            for steel in current_assembly.structural_steel_items:
                d = steel.to_dict()
                temp_children.append((None, "structural_steel_part", d.get("name", ""), json.dumps(d)))

            for sub in current_assembly.get_sub_assemblies():
                queue.append((sub, None))  # Recurse

        # Combine everything and insert
        all_entries = entries + [(parent_id, t, n, d) for _, t, n, d in temp_children]
        await self._bulk_insert_entries(conn, all_entries)

    async def _insert_assembly_recursive(self, conn, assembly: Assembly, parent_id: int):
        assembly_data = json.dumps(assembly.to_dict()["assembly_data"])
        assembly_id = await self._insert_entry(conn, parent_id, "assembly", assembly_data)

        for part in assembly.laser_cut_parts:
            part_data = json.dumps(part.to_dict())
            await self._insert_entry(conn, assembly_id, "laser_cut_part", part_data)

        for component in assembly.components:
            component_data = json.dumps(component.to_dict())
            await self._insert_entry(conn, assembly_id, "component", component_data)

        for structural_steel_part in assembly.structural_steel_items:
            structural_steel_part_data = json.dumps(structural_steel_part.to_dict())
            await self._insert_entry(conn, assembly_id, "structural_steel_part", structural_steel_part_data)

        for sub_assembly in assembly.get_sub_assemblies():
            await self._insert_assembly_recursive(conn, sub_assembly, assembly_id)

    async def close(self):
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None
