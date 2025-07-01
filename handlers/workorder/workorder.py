import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class WorkorderHandler(BaseHandler):
    def get(self, folder_name):
        data_file_path = os.path.join(
            Environment.DATA_PATH, "workorders", folder_name, "data.json"
        )

        if os.path.exists(data_file_path):
            with open(data_file_path, "rb") as file:
                data = msgspec.json.decode(file.read())

            logging.info(
                f"{self.request.remote_ip} loaded workorder: {folder_name}",
            )

            self.set_header("Content-Type", "text/html")
            self.render_template(
                "workorder.html", workorder_id=folder_name, workorder_data=data
            )
        else:
            self.set_status(404)
            self.write("404: HTML file not found.")
