from handlers.base import BaseHandler


class DeleteShippingAddressHandler(BaseHandler):
    async def post(self, shipping_address_id):
        shipping_address_id = int(shipping_address_id)
        client_name = self.get_client_name_from_header()

        await self.shipping_addresses_db.delete_shipping_address(shipping_address_id)

        self.signal_clients_for_changes(client_name, ["/vendors/get_all"])

        self.set_header("Content-Type", "application/json")
        self.write({"id": shipping_address_id, "status": "deleted"})
