import msgspec

from handlers.base import BaseHandler


class UpdateComponentHandler(BaseHandler):
    async def post(self, component_id):
        try:
            component_id = int(component_id)
            data = msgspec.json.decode(self.request.body)
            client_name = self.get_client_name_from_header()

            await self.components_inventory_db.update_component(
                component_id, data, modified_by=client_name
            )
            self.signal_clients_for_changes(
                client_name,
                [f"/components_inventory/get_component/{component_id}"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
