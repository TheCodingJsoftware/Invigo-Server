import hashlib
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

            # default fallback
            if not filepath.endswith((".png", ".jpeg", ".jpg")):
                filepath += ".jpeg"

            if not os.path.exists(filepath):
                self.set_status(404)
                return

            # compute etag
            stat = os.stat(filepath)
            etag = hashlib.md5(str(stat.st_mtime).encode()).hexdigest()

            if self.request.headers.get("If-None-Match") == etag:
                self.set_status(304)
                return

            ext = os.path.splitext(filepath)[1].lower()
            content_type = "image/jpeg" if ext in [".jpeg", ".jpg"] else "image/png"

            self.set_header("Content-Type", content_type)
            self.set_header("Cache-Control", "public, max-age=2592000")  # 30 days
            self.set_header("ETag", etag)

            with open(filepath, "rb") as f:
                self.write(f.read())

            logging.info(f'Sent "{image_name}" to {self.request.remote_ip}')
        except Exception as e:
            logging.error(f"Error serving {image_name}: {e}")
            self.set_status(500)
