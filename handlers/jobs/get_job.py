import msgspec

from handlers.base import BaseHandler


class GetJobHandler(BaseHandler):
    async def get(self, job_id):
        try:
            job_id = int(job_id)
            job_data = await self.jobs_db.get_job_by_id(job_id, include_data=True)
            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(job_data))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
