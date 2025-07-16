import msgspec

from handlers.base import BaseHandler


class UpdateLaserCutPartsHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)
            client_name = self.get_client_name_from_header()
            if not isinstance(data, list):
                raise ValueError("Expected a list of sheets")

            laser_cut_part_ids = []

            for laser_cut_part_data in data:
                laser_cut_part_id = laser_cut_part_data.get("id", -1)
                laser_cut_part_ids.append(laser_cut_part_id)
                await self.laser_cut_parts_inventory_db.update_laser_cut_part(laser_cut_part_id, laser_cut_part_data, modified_by=client_name)
            changes_urls = [f"laser_cut_parts_inventory/get_laser_cut_part/{laser_cut_part_id}" for laser_cut_part_id in laser_cut_part_ids]
            self.signal_clients_for_changes(
                client_name,
                changes_urls,
            )
            self.write(
                {
                    "status": "success",
                    "message": "Laser cut parts updated successfully.",
                }
            )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
