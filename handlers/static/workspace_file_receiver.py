import logging
import os

from config.environments import Environment
from handlers.base import BaseHandler


class WorkspaceFileReceiverHandler(BaseHandler):
    def get(self, file_name: str):
        file_name = os.path.basename(file_name)
        file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
        filepath = os.path.join(Environment.DATA_PATH, "data", "workspace", file_ext, file_name)
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                self.write(f.read())
            logging.info(
                f'Sent "{file_name}" to {self.request.remote_ip}',
            )
        else:
            self.set_status(404)
