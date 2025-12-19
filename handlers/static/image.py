import hashlib
import logging
import os

from config.environments import Environment
from handlers.base import BaseHandler


class ImageHandler(BaseHandler):
    def get(self, image_name: str):
        try:
            image_name = os.path.basename(image_name)
            directory = os.path.join(Environment.DATA_PATH, "images")
            os.makedirs(directory, exist_ok=True)

            filepath = os.path.join(directory, image_name)

            # Default extension fallback
            if not filepath.lower().endswith((".png", ".jpg", ".jpeg")):
                filepath += ".jpeg"

            if not os.path.exists(filepath):
                self.set_status(404)
                return

            stat = os.stat(filepath)

            # Strong-enough ETag for mutable files
            etag = f"{stat.st_mtime_ns}-{stat.st_size}"

            if self.request.headers.get("If-None-Match") == etag:
                self.set_status(304)
                return

            ext = os.path.splitext(filepath)[1].lower()
            content_type = "image/png" if ext == ".png" else "image/jpeg"

            self.set_header("Content-Type", content_type)
            self.set_header(
                "Cache-Control",
                "private, max-age=30, must-revalidate",
            )
            self.set_header("ETag", etag)

            with open(filepath, "rb") as f:
                self.write(f.read())

            logging.info(f'Served image "{image_name}" to {self.request.remote_ip}')

        except Exception as e:
            logging.error(f"Error serving image {image_name}: {e}")
            self.set_status(500)
