import asyncio
import json
import traceback

from utils.database.sheets_inventory_db import SheetsInventoryDB
from utils.sheet_settings import SheetSettings

sheet_settings = SheetSettings()


async def migrate_sheets_inventory_from_json_file(file_path: str):
    db = SheetsInventoryDB()
    await db.connect()

    try:
        # Load data
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        sheets = data.get("sheets", [])
        if not sheets:
            print("No sheets found in the data.")
            return

        print(f"Found {len(sheets)} sheets. Inserting into database...")

        for idx, sheet in enumerate(sheets, start=1):
            sheet["id"] = idx
            sheet_price = sheet_settings.get_sheet_cost(sheet["material"], sheet["thickness"], sheet["length"], sheet["width"])
            sheet["price"] = sheet_price
            price_per_pound = sheet_settings.get_price_per_pound(sheet["material"])
            sheet["price_per_pound"] = price_per_pound
            pounds_per_square_foot = sheet_settings.get_pounds_per_square_foot(sheet["material"], sheet["thickness"])
            sheet["pounds_per_square_foot"] = pounds_per_square_foot
            sheet_id = await db.add_sheet(sheet)
            print(f"[{idx}] Inserted sheet ID: {sheet_id} - Name: {sheet['name']}")
    except Exception as e:
        print(f"Error during migration: {e}")
        traceback.print_exc()
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(migrate_sheets_inventory_from_json_file("data/sheets_inventory.json"))
