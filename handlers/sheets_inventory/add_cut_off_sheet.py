import logging

from handlers.base import BaseHandler
from utils.inventory.sheet import Sheet
from utils.inventory.sheets_inventory import SheetsInventory
from utils.sheet_settings.sheet_settings import SheetSettings


class AddCutoffSheetHandler(BaseHandler):
    async def get(self):
        cutoff_sheets: list[Sheet] = []
        for sheet_data in await self.sheets_inventory_db.get_cutoff_sheets():
            cutoff_sheets.append(Sheet(sheet_data, None))
        sorted_sheets = sorted(
            cutoff_sheets,
            key=lambda s: (s.thickness, s.material, s.length, s.width),
        )
        sheet_settings = SheetSettings()
        template = self.get_template("add_cutoff_sheet.html")
        rendered_template = template.render(
            thicknesses=sheet_settings.get_thicknesses(),
            materials=sheet_settings.get_materials(),
            cutoff_sheets=sorted_sheets,
        )
        self.set_header("Content-Type", "text/html")
        self.write(rendered_template)

    async def post(self):
        sheet_settings = SheetSettings()
        sheets_inventory = SheetsInventory(sheet_settings)
        length = float(self.get_argument("length"))
        width = float(self.get_argument("width"))
        material = self.get_argument("material")
        thickness = self.get_argument("thickness")
        quantity = int(self.get_argument("quantity"))

        new_sheet = Sheet(
            {
                "quantity": quantity,
                "thickness": thickness,
                "material": material,
                "length": length,
                "width": width,
                "categories": ["Cutoff"],
            },
            sheets_inventory,
        )
        await self.sheets_inventory_db.add_sheet(new_sheet.to_dict())

        self.sheets_inventory_db.cache_manager.invalidate("sheets_category_cutoff")
        self.sheets_inventory_db.cache_manager.invalidate("all_sheets")

        self.signal_clients_for_changes(
            None,
            ["/sheets_inventory/get_all"],
        )

        self.redirect("/add_cutoff_sheet")
