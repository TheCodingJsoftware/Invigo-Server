import logging

import msgspec

from handlers.base import BaseHandler


class SaveVendorHandler(BaseHandler):
    async def post(self):
        try:
            vendor_data_json = self.request.files["vendor_data"][0]["body"]
            vendor_data = msgspec.json.decode(vendor_data_json)
            vendor_id = vendor_data.get("id", -1)
            client_name = self.get_client_name_from_header()

            new_vendor_id = await self.vendors_db.save_vendor(vendor_id, vendor_data, modified_by=client_name)

            self.signal_clients_for_changes(client_name, ["/vendors/get_all"])

            self.set_header("Content-Type", "application/json")
            self.write(
                {
                    "status": "success",
                    "message": "Entry updated successfully.",
                    "id": new_vendor_id,
                }
            )
        except Exception as e:
            self.set_status(400)
            logging.error(f"Error saving vendor: {e}")
            self.write({"error": str(e)})
