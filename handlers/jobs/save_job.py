import msgspec

from handlers.base import BaseHandler


class SaveJobHandler(BaseHandler):
    async def post(self):
        try:
            job_data_json = self.request.files["job_data"][0]["body"]
            job_data = msgspec.json.decode(job_data_json)
            job_id = job_data.get("job_data", {}).get("id", -1)
            client_name = self.get_client_name_from_header()

            await self.jobs_db.save_job(job_id, job_data, modified_by=client_name)

            self.signal_clients_for_changes(
                client_name,
                [f"/jobs/get_job/{job_id}"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
