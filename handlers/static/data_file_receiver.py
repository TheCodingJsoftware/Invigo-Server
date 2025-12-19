import logging
import os
from urllib.parse import unquote

from tornado.web import HTTPError

from config.environments import Environment
from handlers.base import BaseHandler


class FileReceiveHandler(BaseHandler):
    """
    Secure file download handler for critical JSON data.

    Guarantees:
    - No caching at any layer
    - Path traversal protection
    - Correct headers
    - Binary-safe streaming
    """

    def get(self, filename: str) -> None:
        # Decode URL encoding and normalize
        filename = unquote(filename)
        filename = os.path.basename(filename)

        # Force JSON only (critical safety boundary)
        if not filename.lower().endswith(".json"):
            raise HTTPError(400, reason="Invalid file type")

        base_dir = os.path.join(Environment.DATA_PATH, "data")
        file_path = os.path.join(base_dir, filename)

        # Ensure path stays inside base_dir
        if not os.path.abspath(file_path).startswith(os.path.abspath(base_dir)):
            raise HTTPError(403, reason="Invalid file path")

        if not os.path.exists(file_path):
            raise HTTPError(404, reason="File not found")

        try:
            self.set_header("Content-Type", "application/json; charset=utf-8")
            self.set_header(
                "Content-Disposition",
                f'attachment; filename="{filename}"',
            )

            # 🚫 Absolutely no caching
            self.set_header(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0",
            )
            self.set_header("Pragma", "no-cache")
            self.set_header("Expires", "0")

            # Optional hardening
            self.set_header("X-Content-Type-Options", "nosniff")

            with open(file_path, "rb") as f:
                while chunk := f.read(64 * 1024):
                    self.write(chunk)

            self.finish()

        except HTTPError:
            raise
        except Exception as e:
            logging.exception("Failed to serve file")
            raise HTTPError(500, reason="Internal server error")
