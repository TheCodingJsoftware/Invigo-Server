import msgspec

from handlers.base import BaseHandler


class DeleteCoatingHandler(BaseHandler):
    async def get(self, coating_id):
        try:
            coating_id = int(coating_id)

            entry_data = await self.coatings_inventory_db.delete_coating(coating_id)

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))

            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/coatings_inventory/get_all"],
            )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
