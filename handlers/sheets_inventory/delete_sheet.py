import msgspec

from handlers.base import BaseHandler


class DeleteSheetHandler(BaseHandler):
    async def get(self, sheet_id):
        try:
            sheet_id = int(sheet_id)
            entry_data = await self.sheets_inventory_db.delete_sheet(sheet_id)

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))

            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/sheets_inventory/get_all"],
            )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
