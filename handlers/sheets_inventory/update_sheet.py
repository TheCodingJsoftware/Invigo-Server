import msgspec

from handlers.base import BaseHandler


class UpdateSheetHandler(BaseHandler):
    async def post(self, sheet_id):
        try:
            sheet_id = int(sheet_id)
            client_name = self.get_client_name_from_header()

            data = msgspec.json.decode(self.request.body)
            await self.sheets_inventory_db.update_sheet(sheet_id, data, modified_by=client_name)
            self.signal_clients_for_changes(
                client_name,
                [f"sheets_inventory/get_sheet/{sheet_id}"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
