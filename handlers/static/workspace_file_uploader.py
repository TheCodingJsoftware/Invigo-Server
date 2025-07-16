import logging
import os
from pathlib import Path

from config.environments import Environment
from handlers.base import BaseHandler


class WorkspaceFileUploader(BaseHandler):
    def post(self):
        if file_info := self.request.files.get("file"):
            file_data = file_info[0]["body"]
            file_name: str = os.path.basename(file_info[0]["filename"])
            file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
            file_path = os.path.join(Environment.DATA_PATH, "data", "workspace", file_ext)
            Path(file_path).mkdir(parents=True, exist_ok=True)
            with open(os.path.join(file_path, file_name), "wb") as file:
                file.write(file_data)
            logging.info(
                f'{self.request.remote_ip} uploaded "{file_name}"',
            )
            self.write("File uploaded successfully.")
        else:
            logging.error("No file received.")
            self.write("No file received.")
