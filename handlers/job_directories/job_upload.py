import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class UploadJobDirectoryHandler(BaseHandler):
    def post(self):
        try:
            folder = self.get_argument("folder")

            job_data_json = self.request.files["job_data"][0]["body"]
            job_data = msgspec.json.decode(job_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            job_file_path = os.path.join(Environment.DATA_PATH, folder, "data.json")
            with open(job_file_path, "wb") as f:
                f.write(msgspec.json.encode(job_data))

            html_file_path = os.path.join(Environment.DATA_PATH, folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                ["reload_saved_jobs"],
            )

            self.write(
                {
                    "status": "success",
                    "message": "Job and HTML file uploaded successfully.",
                }
            )
            self.job_directory_cache.invalidate_cache()
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})
