import msgspec

from handlers.base import BaseHandler


class DeletePurchaseOrderHandler(BaseHandler):
    async def post(self, purchase_order_id):
        purchase_order_id = int(purchase_order_id)
        client_name = self.get_client_name_from_header()

        response_id = await self.purchase_orders_db.delete_purchase_order(purchase_order_id)

        self.signal_clients_for_changes(client_name, ["/purchase_orders/get_all"])

        self.set_header("Content-Type", "application/json")
        self.write(msgspec.json.encode(response_id))
