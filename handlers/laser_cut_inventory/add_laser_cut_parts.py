import msgspec

from handlers.base import BaseHandler


class AddLaserCutPartsHandler(BaseHandler):
    async def post(self):
        try:
            response_data = {}
            data = msgspec.json.decode(self.request.body)
            for part_data in data:
                laser_cut_part_id = (
                    await self.laser_cut_parts_inventory_db.add_laser_cut_part(
                        part_data
                    )
                )
                response_data[part_data["name"]] = laser_cut_part_id
            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/laser_cut_parts_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "response_data": response_data})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
