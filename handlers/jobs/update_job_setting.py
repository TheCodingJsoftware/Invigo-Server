from handlers.base import BaseHandler


class UpdateJobSettingHandler(BaseHandler):
    async def post(self, job_id: str):
        try:
            job_id = int(job_id)
            key = self.get_argument("key")
            value = self.get_argument("value")

            if key == "type":  # For some reason it gets parsed as a string
                value = int(value)
            client_name = self.get_client_name_from_header()

            await self.jobs_db.update_job_setting(job_id, key, value, modified_by=client_name)

            self.signal_clients_for_changes(
                None,
                ["/jobs/get_all"],
            )
            self.set_header("Content-Type", "application/json")
            self.write({"status": "success", "message": "Entry updated successfully."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
