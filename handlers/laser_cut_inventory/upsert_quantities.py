import msgspec

from handlers.base import BaseHandler


class UpsertQuantitiesHandler(BaseHandler):
    async def post(self):
        client_name = self.get_client_name_from_header()
        operation = self.get_query_argument("operation", default="ADD")

        try:
            response_data = {}
            data = msgspec.json.decode(self.request.body)
            for part_data in data:
                laser_cut_part_id = (
                    await self.laser_cut_parts_inventory_db.upsert_quantities(
                        part_data, operation=operation, modified_by=client_name
                    )
                )
                response_data[part_data["name"]] = laser_cut_part_id
            self.signal_clients_for_changes(
                None,
                ["/laser_cut_parts_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "response_data": response_data})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
