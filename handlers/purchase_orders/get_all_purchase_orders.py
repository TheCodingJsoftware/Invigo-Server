import msgspec

from handlers.base import BaseHandler


class GetAllPurchaseOrdersHandler(BaseHandler):
    async def get(self):
        entry_data = await self.purchase_orders_db.get_all_purchase_orders(include_data=True)
        self.set_header("Content-Type", "application/json")
        self.write(msgspec.json.encode(entry_data))
