import asyncio
import json

import laser_cut_part_convert_old_to_new
from utils.database.laser_cut_parts_inventory_db import LaserCutPartsInventoryDB


async def migrate_laser_cut_parts_inventory_from_json_file(file_path: str):
    db = LaserCutPartsInventoryDB()
    await db.connect()

    try:
        # Load data
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        laser_cut_parts = data.get("laser_cut_parts", [])
        if not laser_cut_parts:
            print("No laser_cut_parts found in the data.")
            return

        print(f"Found {len(laser_cut_parts)} laser_cut_parts. Inserting into database...")

        for idx, laser_cut_part in enumerate(laser_cut_parts, start=1):
            new_laser_cut_part = laser_cut_part_convert_old_to_new.convert(laser_cut_part)
            laser_cut_part["id"] = idx
            laser_cut_part_id = await db.add_laser_cut_part(new_laser_cut_part)
            print(f"[{idx}] Inserted laser_cut_part ID: {laser_cut_part_id} - Name: {new_laser_cut_part['name']}")

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(migrate_laser_cut_parts_inventory_from_json_file("data/laser_cut_inventory.json"))
