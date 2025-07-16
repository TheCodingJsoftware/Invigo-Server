import msgspec

from handlers.base import BaseHandler


class GetVendorHandler(BaseHandler):
    async def get(self, vendor_id):
        try:
            vendor_id = int(vendor_id)
            job_data = await self.vendors_db.get_vendor_by_id(vendor_id)
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(job_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
