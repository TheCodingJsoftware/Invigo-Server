import msgspec

from handlers.base import BaseHandler


class AddSheetHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            sheet_id = await self.sheets_inventory_db.add_sheet(data)
            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/sheets_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "id": sheet_id})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
