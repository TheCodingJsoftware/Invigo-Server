import os

from config.environments import Environment
from handlers.base import BaseHandler


class LoadWorkorderPrintoutHandler(BaseHandler):
    def get(self, folder_name):
        html_file_path = os.path.join(
            Environment.DATA_PATH, "workorders", folder_name, "page.html"
        )

        if os.path.exists(html_file_path):
            with open(html_file_path, "r", encoding="utf-8") as file:
                html_content = file.read()

            self.set_header("Content-Type", "text/html")
            self.write(html_content)
        else:
            self.set_status(404)
            self.write("404: HTML file not found.")
