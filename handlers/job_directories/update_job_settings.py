import os
import shutil

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler
from utils.workspace.job import JobStatus


class UpdateJobSettingsHandler(BaseHandler):
    def post(self):
        folder = self.get_argument("folder")
        folder = folder.replace("\\", "/")
        folder = os.path.join(Environment.DATA_PATH, folder)
        job_name = os.path.basename(folder)
        key_to_change = self.get_argument("key")
        new_value = self.get_argument("value")

        if key_to_change == "type":  # For some reason it gets parsed as a string
            new_value = int(new_value)

        file_path = os.path.join(folder, "data.json")

        try:
            if os.path.exists(file_path):
                with open(file_path, "rb") as file:
                    data = msgspec.json.decode(file.read())

                data["job_data"][key_to_change] = new_value

                with open(file_path, "wb") as file:
                    file.write(msgspec.json.encode(data))
                if key_to_change == "type":
                    destination = (
                        f"saved_jobs\\{JobStatus(new_value).name.lower()}\\{job_name}"
                    )
                    if os.path.exists(destination):
                        shutil.rmtree(destination)
                    shutil.move(folder, destination)

                self.signal_clients_for_changes(
                    self.get_client_name_from_header(),
                    ["reload_saved_jobs"],
                )

                self.write(
                    {
                        "status": "success",
                        "message": "Job settings updated successfully.",
                    }
                )
                self.job_directory_cache.invalidate_cache()
            else:
                self.set_status(404)
                self.write({"status": "error", "message": "File not found."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})
