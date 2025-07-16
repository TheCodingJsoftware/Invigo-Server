import msgspec

from handlers.base import BaseHandler


class GetAllShippingAddressesHandler(BaseHandler):
    async def get(self):
        try:
            entry_data = await self.shipping_addresses_db.get_all_shipping_addresses()
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
