from handlers.base import BaseHandler


class DeleteVendorHandler(BaseHandler):
    async def post(self, vendor_id):
        vendor_id = int(vendor_id)
        client_name = self.get_client_name_from_header()

        await self.vendors_db.delete_vendor(vendor_id)

        self.signal_clients_for_changes(client_name, ["/vendors/get_all"])

        self.set_header("Content-Type", "application/json")
        self.write({"id": vendor_id, "status": "deleted"})
