import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class UploadWorkorderHandler(BaseHandler):
    def post(self):
        try:
            folder = os.path.join(
                Environment.DATA_PATH, "workorders", self.get_argument("folder")
            )

            workorder_data_json = self.request.files["workorder_data"][0]["body"]
            workorder_data = msgspec.json.decode(workorder_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            workorder_file_path = os.path.join(folder, "data.json")
            with open(workorder_file_path, "wb") as f:
                f.write(msgspec.json.encode(workorder_data))

            workorder_backup_file_path = os.path.join(folder, "data_backup.json")
            with open(workorder_backup_file_path, "wb") as f:
                f.write(msgspec.json.encode(workorder_data))

            html_file_path = os.path.join(folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            logging.info(
                f"{self.request.remote_ip} uploaded workorder: {folder}",
            )

            self.write(
                {
                    "status": "success",
                    "message": "Workorder and HTML file uploaded successfully.",
                }
            )
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})
