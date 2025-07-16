import asyncio
import json

from utils.database.coatings_inventory_db import CoatingsInventoryDB
from utils.database.components_inventory_db import ComponentsInventoryDB
from utils.inventory.coating_item import CoatingItem


async def migrate_coatings_inventory_from_json_file(file_path: str):
    # NOTE: Ensure components inventory is up to date
    components_db = ComponentsInventoryDB()
    await components_db.connect()
    coatings_db = CoatingsInventoryDB()
    await coatings_db.connect()

    try:
        # Load data
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        primers = data.get("primers", [])
        paints = data.get("paints", [])
        powders = data.get("powders", [])

        coatings = primers + paints + powders
        if not coatings:
            print("No coatings found in the data.")
            return

        print(f"Found {len(coatings)} coatings. Inserting into database...")

        idx = 1

        for primer_data in primers:
            componet_id = await components_db.get_component_id(primer_data["name"])
            primer_data["id"] = idx
            primer_data["component_id"] = componet_id
            primer_data["coating_type"] = "Primer"
            primer_data["part_name"] = primer_data["name"]
            primer_data["part_number"] = ""
            primer_data["average_coverage"] = primer_data.get("average_coverage", 300)
            primer_data["gravity"] = primer_data.get("gravity", 2.0)
            coating_id = await coatings_db.add_coating(primer_data)
            print(f"[{idx}] Inserted primer ID: {coating_id} - Name: {primer_data['name']}")
            idx += 1

        for paint_data in paints:
            componet_id = await components_db.get_component_id(paint_data["name"])
            paint_data["id"] = idx
            paint_data["component_id"] = componet_id
            paint_data["coating_type"] = "Paint"
            paint_data["part_name"] = paint_data["name"]
            paint_data["part_number"] = ""
            paint_data["average_coverage"] = paint_data.get("average_coverage", 300)
            paint_data["gravity"] = paint_data.get("gravity", 2.0)
            coating_id = await coatings_db.add_coating(paint_data)
            print(f"[{idx}] Inserted paint ID: {coating_id} - Name: {paint_data['name']}")
            idx += 1

        for powder_data in powders:
            componet_id = await components_db.get_component_id(powder_data["name"])
            powder_data["id"] = idx
            powder_data["component_id"] = componet_id
            powder_data["coating_type"] = "Powder"
            powder_data["part_name"] = powder_data["name"]
            powder_data["part_number"] = ""
            powder_data["average_coverage"] = powder_data.get("average_coverage", 300)
            powder_data["gravity"] = powder_data.get("gravity", 2.0)
            coating_id = await coatings_db.add_coating(powder_data)
            print(f"[{idx}] Inserted powder ID: {coating_id} - Name: {powder_data['name']}")
            idx += 1

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        await coatings_db.close()


if __name__ == "__main__":
    asyncio.run(migrate_coatings_inventory_from_json_file("data/paint_inventory.json"))
