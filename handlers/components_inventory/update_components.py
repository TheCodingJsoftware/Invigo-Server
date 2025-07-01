import msgspec

from handlers.base import BaseHandler


class UpdateComponentsHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            client_name = self.get_client_name_from_header()

            if not isinstance(data, list):
                raise ValueError("Expected a list of sheets")
            component_ids = []
            for component_data in data:
                component_id = component_data.get("id", -1)
                component_ids.append(component_id)
                await self.components_inventory_db.update_component(
                    component_id, component_data, modified_by=client_name
                )
            changes_urls = [
                f"/components_inventory/get_component/{component_id}"
                for component_id in component_ids
            ]
            self.signal_clients_for_changes(
                client_name,
                changes_urls,
            )
            self.write({"status": "success", "message": "Sheets updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
