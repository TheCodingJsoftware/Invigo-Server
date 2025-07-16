from datetime import datetime

from handlers.base import BaseHandler
from utils.inventory.order import Order
from utils.inventory.sheet import Sheet
from utils.inventory.sheets_inventory import SheetsInventory
from utils.sheet_settings.sheet_settings import SheetSettings


class SheetQuantityHandler(BaseHandler):
    sheet_settings = SheetSettings()
    sheets_inventory = SheetsInventory(sheet_settings)

    async def get(self, sheet_name: str):
        sheet_name = sheet_name.replace("_", " ")
        sheet_exists = await self.sheets_inventory_db.sheet_exists(sheet_name)
        if sheet_exists:
            await self.load_page(sheet_name)
        else:
            self.set_status(404)
            self.write("Sheet not found")

    def load_trusted_users(self, file_path: str):
        with open(file_path, "r", encoding="utf-8") as file:
            return [line.strip() for line in file if line.strip()]

    async def load_page(self, sheet_name):
        trusted_users = self.load_trusted_users("trusted_users.txt")

        sheet_data = await self.sheets_inventory_db.get_sheet(sheet_name)

        sheet = Sheet(
            sheet_data,
            self.sheets_inventory,
        )

        template = self.get_template("sheet_template.html") if self.request.remote_ip in trusted_users else self.get_template("sheet_template_read_only.html")

        rendered_template = template.render(sheet_name=sheet_name, quantity=sheet.quantity, pending_data=sheet.orders)

        self.set_status(200)
        self.set_header("Content-Type", "text/html")
        self.write(rendered_template)

    async def post(self, sheet_name):
        new_quantity = float(self.get_argument("new_quantity"))
        try:
            order_pending_quantity = float(self.get_argument("order_pending_quantity"))
        except ValueError:  # Add Incoming Quantity was NOT used
            order_pending_quantity = 0.0
        order_pending_date = self.get_argument("order_pending_date")
        expected_arrival_time = self.get_argument("expected_arrival_time")
        notes = self.get_argument("notes")

        other_order = Order(
            {
                "expected_arrival_time": expected_arrival_time,
                "order_pending_quantity": order_pending_quantity,
                "order_pending_date": order_pending_date,
                "notes": notes,
            }
        )

        sheet_data = await self.sheets_inventory_db.get_sheet(sheet_name)
        sheet = Sheet(
            sheet_data,
            self.sheets_inventory,
        )

        sheet_order_used = None
        for order in sheet.orders:
            if order == other_order:
                sheet_order_used = order
                break
        if sheet_order_used:
            old_quantity = sheet.quantity
            quantity_to_add = new_quantity - old_quantity
            remaining_order_quantity = sheet_order_used.quantity - quantity_to_add
            sheet_order_used.quantity = remaining_order_quantity
            if remaining_order_quantity <= 0:
                sheet.remove_order(sheet_order_used)
            sheet.latest_change_quantity = (
                f"Set to {new_quantity} with Add Incoming Order Quantity ({quantity_to_add}) with QR code at {datetime.now().strftime('%B %d %A %Y %I:%M:%S %p')}"
            )
        else:
            sheet.latest_change_quantity = f"Set to {new_quantity} with QR code at {datetime.now().strftime('%B %d %A %Y %I:%M:%S %p')}"

        sheet.quantity = new_quantity

        if new_quantity >= sheet.red_quantity_limit:
            sheet.has_sent_warning = False

        await self.sheets_inventory_db.update_sheet(sheet.id, sheet.to_dict(), modified_by="system")

        self.sheets_inventory_db.cache_manager.invalidate(f"sheet_{sheet_name}")

        self.signal_clients_for_changes(
            None,
            [f"/sheets_inventory/get_sheet/{sheet.id}"],
        )

        self.redirect(f"/sheets_in_inventory/{sheet_name}")
