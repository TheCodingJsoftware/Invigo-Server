import msgspec

from handlers.base import BaseHandler


class GetLaserCutPartHandler(BaseHandler):
    async def get(self, entry_id):
        try:
            entry_id = int(entry_id)
            entry_data = await self.laser_cut_parts_inventory_db.get_laser_cut_part(entry_id)
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
