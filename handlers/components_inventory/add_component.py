import msgspec

from handlers.base import BaseHandler


class AddComponentHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            component_id = await self.components_inventory_db.add_component(data)
            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/components_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "id": component_id})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
