import msgspec

from handlers.base import BaseHandler


class UpdateSheetsHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            client_name = self.get_client_name_from_header()

            if not isinstance(data, list):
                raise ValueError("Expected a list of sheets")
            sheet_ids = []
            for sheet_data in data:
                sheet_id = sheet_data.get("id", -1)
                sheet_ids.append(sheet_id)
                await self.sheets_inventory_db.update_sheet(sheet_id, sheet_data, modified_by=client_name)
            changes_urls = [f"sheets_inventory/get_sheet/{sheet_id}" for sheet_id in sheet_ids]
            self.signal_clients_for_changes(
                client_name,
                changes_urls,
            )
            self.write({"status": "success", "message": "Sheets updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
