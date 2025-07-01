import msgspec

from handlers.base import BaseHandler


class DeleteComponentHandler(BaseHandler):
    async def get(self, component_id):
        try:
            component_id = int(component_id)
            entry_data = await self.components_inventory_db.delete_component(
                component_id
            )

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))

            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/components_inventory/get_all"],
            )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
