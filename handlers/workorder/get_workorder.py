import msgspec

from handlers.base import BaseHandler


class GetWorkorderHandler(BaseHandler):
    async def get(self, workorder_id):
        try:
            workorder_id = int(workorder_id)
            workorder_data = await self.workorders_db.get_workorder_by_id(workorder_id)
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(workorder_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
