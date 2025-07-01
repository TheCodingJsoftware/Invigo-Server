import asyncio
import json

from utils.database.components_inventory_db import ComponentsInventoryDB


async def migrate_components_inventory_from_json_file(file_path: str):
    db = ComponentsInventoryDB()
    await db.connect()

    try:
        # Load data
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        components = data.get("components", [])
        if not components:
            print("No components found in the data.")
            return

        print(f"Found {len(components)} components. Inserting into database...")

        for idx, component in enumerate(components, start=1):
            component["id"] = idx
            component["name"] = component["part_number"]
            component_id = await db.add_component(component)
            print(
                f"[{idx}] Inserted component ID: {component_id} - Name: {component['name']}"
            )

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(
        migrate_components_inventory_from_json_file("data/components_inventory.json")
    )
