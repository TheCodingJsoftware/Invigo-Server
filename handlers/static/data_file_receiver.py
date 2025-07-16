import os

from config.environments import Environment
from handlers.base import BaseHandler


class FileReceiveHandler(BaseHandler):
    def get(self, filename: str):
        file_path = os.path.join(Environment.DATA_PATH, "data", filename)
        try:
            with open(file_path, "rb") as file:
                data = file.read()
                self.set_header("Content-Type", "application/json")
                self.set_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.write(data)
        except FileNotFoundError:
            self.set_status(404)
            self.write(f'File "{filename}" not found.')
