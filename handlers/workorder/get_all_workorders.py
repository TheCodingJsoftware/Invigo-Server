import msgspec

from handlers.base import BaseHandler


class GetAllWorkordersHandler(BaseHandler):
    async def get(self):
        try:
            entry_data = await self.workorders_db.get_all_workorders()
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
