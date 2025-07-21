import msgspec

from handlers.base import BaseHandler


class SaveWorkorderHandler(BaseHandler):
    async def post(self):
        try:
            workorder_data_json = self.request.files["workorder_data"][0]["body"]
            workorder_data = msgspec.json.decode(workorder_data_json)
            workorder_id = workorder_data.get("workorder_data", {}).get("id", -1)
            client_name = self.get_client_name_from_header()

            new_workorder_id = await self.workorders_db.save_workorder(workorder_id, workorder_data, modified_by=client_name)

            # self.signal_clients_for_changes(
            #     client_name,
            #     [f"/jobs/{workorder_id}"],
            # )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully.", "id": new_workorder_id})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
            self.write_error(500)
