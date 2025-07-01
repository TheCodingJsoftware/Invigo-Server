import msgspec

from handlers.base import BaseHandler


class WorkspaceGetRecutPartsFromJobHandler(BaseHandler):
    async def get(self, job_id: int | None = None):
        try:
            if job_id:
                job_id = int(job_id)
            entry_data = await self.workspace_db.get_all_recut_parts(job_id)
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entry_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
