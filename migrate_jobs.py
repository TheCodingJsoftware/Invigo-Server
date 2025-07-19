import asyncio
import json
import os

import assembly_convert_old_to_new
import laser_cut_part_convert_old_to_new
from utils.database.jobs_db import JobsDB


def migrate_laser_cut_parts_in_assemblies(assembly_data: dict):
    if "laser_cut_parts" in assembly_data:
        converted_parts = []
        for part_data in assembly_data["laser_cut_parts"]:
            new_part = laser_cut_part_convert_old_to_new.convert(part_data)
            converted_parts.append(new_part)
        assembly_data["laser_cut_parts"] = converted_parts

    if "sub_assemblies" in assembly_data:
        for sub in assembly_data["sub_assemblies"]:
            migrate_laser_cut_parts_in_assemblies(sub)


def migrate_laser_cut_parts_in_nests(nest_data: dict):
    if "laser_cut_parts" in nest_data:
        converted_parts = []
        for part_data in nest_data["laser_cut_parts"]:
            new_part = laser_cut_part_convert_old_to_new.convert(part_data)
            converted_parts.append(new_part)
        nest_data["laser_cut_parts"] = converted_parts


async def migrate_jobs_from_job_directories(folder: str):
    all_jobs_data_paths = []
    job_paths = os.listdir(folder)
    for job_path in job_paths:
        file_paths = os.listdir(os.path.join(folder, job_path))
        for file_path in file_paths:
            job_data_path = os.path.join(folder, job_path, file_path, "data.json")
            if os.path.exists(job_data_path):
                all_jobs_data_paths.append(job_data_path)

    print(f"Found {len(all_jobs_data_paths)} jobs. Inserting into database...")

    db = JobsDB()
    await db.connect()

    # Load data
    for idx, data_path in enumerate(all_jobs_data_paths, start=1):
        with open(data_path, "r", encoding="utf-8") as f:
            job_data = json.load(f)

            job_data["job_data"]["id"] = idx
            converted_assemblies = []
            for assembly in job_data.get("assemblies", []):
                converted = assembly_convert_old_to_new.convert(assembly)
                migrate_laser_cut_parts_in_assemblies(converted)
                converted_assemblies.append(converted)
            job_data["assemblies"] = converted_assemblies

            for nest in job_data.get("nests", []):
                migrate_laser_cut_parts_in_nests(nest)

            try:
                job_id = await db.add_job(job_data)
                print(f"[{idx}] Inserted job ID: {job_id} - Name: {job_data['job_data']['name']}")

            except Exception as e:
                print(f"Error during migration: {e} with job data: {job_data}")
    await db.close()


if __name__ == "__main__":
    asyncio.run(migrate_jobs_from_job_directories("saved_jobs"))
