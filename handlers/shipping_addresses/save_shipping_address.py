import logging

import msgspec

from handlers.base import BaseHandler


class SaveShippingAddressHandler(BaseHandler):
    async def post(self):
        try:
            shipping_address_data_json = self.request.files["shipping_address_data"][0]["body"]
            shipping_address_data = msgspec.json.decode(shipping_address_data_json)
            shipping_address_id = shipping_address_data.get("id", -1)
            client_name = self.get_client_name_from_header()

            new_shipping_address_id = await self.shipping_addresses_db.save_shipping_address(shipping_address_id, shipping_address_data, modified_by=client_name)

            self.signal_clients_for_changes(client_name, ["/shipping_addresses/get_all"])

            self.set_header("Content-Type", "application/json")
            self.write(
                {
                    "status": "success",
                    "message": "Entry updated successfully.",
                    "id": new_shipping_address_id,
                }
            )
        except Exception as e:
            self.set_status(400)
            logging.error(f"Error saving shipping_address: {e}")
            self.write({"error": str(e)})
