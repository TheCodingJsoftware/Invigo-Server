from handlers.base import BaseHandler
from utils.inventory.sheets_inventory import SheetsInventory
from utils.sheet_settings.sheet_settings import SheetSettings


class QRCodePageHandler(BaseHandler):
    def get(self):
        sheet_settings = SheetSettings()
        sheets_inventory = SheetsInventory(sheet_settings)
        sheet_data: dict[str, list[str]] = {}
        for category in sheets_inventory.get_categories():
            if category.name == "Cutoff":
                continue
            sheet_data |= {category.name: []}
            for sheet in sheets_inventory.get_sheets_by_category(category):
                sheet_data[category.name].append(sheet.get_name())

        self.set_header("Content-Type", "text/html")
        self.render_template("view_qr_codes.html", sheet_data=sheet_data)
