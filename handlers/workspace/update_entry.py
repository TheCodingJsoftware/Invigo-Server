import msgspec

from handlers.base import BaseHandler


class WorkspaceUpdateEntryHandler(BaseHandler):
    async def post(self, entry_id):
        try:
            entry_id = int(entry_id)
            data = msgspec.json.decode(self.request.body)
            await self.workspace_db.update_entry(entry_id, data)
            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                [f"workspace/get_entry/{entry_id}"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
