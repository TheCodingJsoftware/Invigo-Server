import msgspec

from handlers.base import BaseHandler


class GetLaserCutPartsCategoriesHandler(BaseHandler):
    async def get(self):
        try:
            entry_data = await self.laser_cut_parts_inventory_db.get_categories()
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
