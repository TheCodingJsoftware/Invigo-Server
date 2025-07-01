from handlers.base import BaseHandler


class WorkspaceGetAllJobsHandler(BaseHandler):
    async def get(self):
        try:
            job_data = await self.workspace_db.get_all_jobs()
            self.set_header("Content-Type", "application/json")
            self.write({"success": True, "jobs": job_data})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
            self.write({"error": str(e)})
