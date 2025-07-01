import asyncio
import json
import os

from utils.database.jobs_db import JobsDB


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
            try:
                job_id = await db.add_job(job_data)
                print(
                    f"[{idx}] Inserted job ID: {job_id} - Name: {job_data['job_data']['name']}"
                )

            except Exception as e:
                print(f"Error during migration: {e} with job data: {job_data}")
    await db.close()


if __name__ == "__main__":
    asyncio.run(migrate_jobs_from_job_directories("saved_jobs"))
