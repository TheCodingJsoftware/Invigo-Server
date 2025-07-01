import msgspec

from handlers.base import BaseHandler


class GetCoatingHandler(BaseHandler):
    async def get(self, coating_id):
        try:
            coating_id = int(coating_id)

            entry_data = await self.coatings_inventory_db.get_coating(coating_id)

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
