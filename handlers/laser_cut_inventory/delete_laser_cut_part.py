import msgspec

from handlers.base import BaseHandler


class DeleteLaserCutPartsHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            for part_id in data:
                await self.laser_cut_parts_inventory_db.delete_laser_cut_part(part_id)

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(data))

            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["/laser_cut_parts_inventory/get_all"],
            )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
