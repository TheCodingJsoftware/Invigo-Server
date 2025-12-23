import os

from config.environments import Environment
from handlers.base import BaseHandler


class LogDeleteHandler(BaseHandler):
    def post(self):
        log_file_name = self.get_argument("log_file_name")
        log_dir = "logs/"
        log_file_path = os.path.join(Environment.DATA_PATH, log_dir, log_file_name)

        if os.path.isfile(log_file_path):
            os.remove(log_file_path)
            self.write(f"Log file {log_file_name} deleted")
        else:
            self.set_status(404)
            self.write("Log file not found")
