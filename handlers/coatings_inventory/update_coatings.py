import msgspec

from handlers.base import BaseHandler


class UpdateCoatingsHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)

            client_name = self.get_client_name_from_header()

            for coating_data in data:
                coating_id = coating_data.get("id")
                await self.coatings_inventory_db.save_coating(
                    coating_id, coating_data, modified_by=client_name
                )
            self.signal_clients_for_changes(
                client_name,
                ["/coatings_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
