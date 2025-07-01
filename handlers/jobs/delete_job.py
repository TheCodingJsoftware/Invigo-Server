import msgspec

from handlers.base import BaseHandler


class DeleteJobHandler(BaseHandler):
    async def post(self, job_id):
        try:
            job_id = int(job_id)

            response_id = await self.jobs_db.delete_job(job_id)

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(response_id))

            self.signal_clients_for_changes(
                None,
                ["/jobs/get_all"],
            )
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
