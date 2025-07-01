import msgspec

from handlers.base import BaseHandler


class WorkspaceGetEntryHandler(BaseHandler):
    async def get(self, entry_id):
        try:
            entry_id = int(entry_id)
            entry_data = await self.workspace_db.get_entry_by_id(entry_id)
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
