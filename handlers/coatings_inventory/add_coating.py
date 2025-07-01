import msgspec

from handlers.base import BaseHandler


class AddCoatingHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)

            coating_id = await self.coatings_inventory_db.add_coating(data)

            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/coatings_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "id": coating_id})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
