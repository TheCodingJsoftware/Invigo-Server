import os

from config.environments import Environment
from handlers.base import BaseHandler


class DownloadJobDirectoryHandler(BaseHandler):
    def get(self, folder_name: str):
        folder_name = folder_name.replace("\\", "/").replace("//", "/")
        json_file_path = os.path.join(Environment.DATA_PATH, folder_name, "data.json")

        if os.path.exists(json_file_path):
            self.set_header("Content-Type", "application/octet-stream")
            self.set_header("Content-Disposition", f'attachment; filename="{folder_name}_job.json"')
            with open(json_file_path, "rb") as file:
                data = file.read()

            self.write(data)
            self.finish()
        else:
            self.set_status(404)
            self.write("404: File not found")
