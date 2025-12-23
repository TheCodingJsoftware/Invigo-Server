import os

from config.environments import Environment
from handlers.base import BaseHandler


class LogsHandler(BaseHandler):
    def get(self):
        log_dir = os.path.join(Environment.DATA_PATH, "logs")

        server_logs = []
        error_logs = []

        for file in os.listdir(log_dir):
            if os.path.isfile(os.path.join(log_dir, file)):
                file_path = os.path.join(log_dir, file)
                file_info = {
                    "name": file,
                    "mtime": os.path.getmtime(file_path),
                }  # Get the modification time
                if "Server Log" in file:
                    server_logs.append(file_info)
                elif "Error Log" in file:
                    error_logs.append(file_info)

        # Sort logs by modification time (newest first)
        server_logs.sort(key=lambda x: x["mtime"], reverse=True)
        error_logs.sort(key=lambda x: x["mtime"], reverse=True)

        self.render_template(
            "logs.html",
            server_logs=[log["name"] for log in server_logs],
            error_logs=[log["name"] for log in error_logs],
        )
