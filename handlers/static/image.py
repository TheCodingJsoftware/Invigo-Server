import logging
import os

from config.environments import Environment
from handlers.base import BaseHandler


class ImageHandler(BaseHandler):
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type")
        self.set_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def options(self, *args, **kwargs):
        self.set_status(204)
        self.finish()

    def get(self, image_name: str):
        try:
            image_name = os.path.basename(image_name)
            directory = os.path.join(Environment.DATA_PATH, "images")
            os.makedirs(directory, exist_ok=True)
            filepath = os.path.join(directory, image_name)
            if not filepath.endswith(".png") and not filepath.endswith(".jpeg"):
                filepath += ".jpeg"
            if os.path.exists(filepath):
                with open(filepath, "rb") as f:
                    self.set_header("Content-Type", "image/jpeg")
                    self.write(f.read())
                logging.info(
                    f'Sent "{image_name}" to {self.request.remote_ip}',
                )
            else:
                self.set_status(404)
        except FileNotFoundError:
            self.set_status(404)
