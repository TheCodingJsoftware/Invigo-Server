import msgspec

from handlers.base import BaseHandler


class GetAllVendorsHandler(BaseHandler):
    async def get(self):
        try:
            entry_data = await self.vendors_db.get_all_vendors()
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
