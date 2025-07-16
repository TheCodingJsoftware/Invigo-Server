from handlers.base import BaseHandler


class WorkspaceDeleteJobHandler(BaseHandler):
    async def post(self, job_id):
        try:
            await self.workspace_db.delete_job(job_id)
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": f"Job {job_id} deleted successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
