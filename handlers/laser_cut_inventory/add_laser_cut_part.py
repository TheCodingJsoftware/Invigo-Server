import msgspec

from handlers.base import BaseHandler


class AddLaserCutPartHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            laser_cut_part_id = (
                await self.laser_cut_parts_inventory_db.add_laser_cut_part(data)
            )
            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/laser_cut_parts_inventory/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "id": laser_cut_part_id})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
