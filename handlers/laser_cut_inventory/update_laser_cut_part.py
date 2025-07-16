import msgspec

from handlers.base import BaseHandler


class UpdateLaserCutPartHandler(BaseHandler):
    async def post(self, laser_cut_part_id):
        try:
            laser_cut_part_id = int(laser_cut_part_id)
            client_name = self.get_client_name_from_header()

            data = msgspec.json.decode(self.request.body)
            await self.laser_cut_parts_inventory_db.update_laser_cut_part(laser_cut_part_id, data, modified_by=client_name)
            self.signal_clients_for_changes(
                client_name,
                [f"laser_cut_parts_inventory/get_laser_cut_part/{laser_cut_part_id}"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
