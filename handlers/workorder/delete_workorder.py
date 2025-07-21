import msgspec

from handlers.base import BaseHandler


class DeleteWorkorderHandler(BaseHandler):
    async def post(self, workorder_id):
        try:
            workorder_id = int(workorder_id)

            response_id = await self.workorders_db.delete_workorder(workorder_id)

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(response_id))

            # self.signal_clients_for_changes(
            #     None,
            #     ["/jobs/get_all"],
            # )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
