import msgspec

from handlers.base import BaseHandler


class GetPurchaseOrderHandler(BaseHandler):
    async def get(self, purchase_order_id):
        purchase_order_id = int(purchase_order_id)
        job_data = await self.purchase_orders_db.get_purchase_order_by_id(purchase_order_id)
        self.set_header("Content-Type", "application/json")
        self.write(msgspec.json.encode(job_data))
