import msgspec

from handlers.base import BaseHandler


class SavePurchaseOrderHandler(BaseHandler):
    async def post(self):
        purchase_order_data_json = self.request.files["purchase_order_data"][0]["body"]
        purchase_order_data = msgspec.json.decode(purchase_order_data_json)
        purchase_order_id = purchase_order_data.get("id", -1)
        client_name = self.get_client_name_from_header()

        new_id = await self.purchase_orders_db.save_purchase_order(purchase_order_id, purchase_order_data, modified_by=client_name)

        self.signal_clients_for_changes(client_name, ["/purchase_orders/get_all"])

        self.set_header("Content-Type", "application/json")
        self.write(
            {
                "status": "success",
                "message": "Entry updated successfully.",
                "id": new_id,
            }
        )
