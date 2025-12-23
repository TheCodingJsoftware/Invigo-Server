import mimetypes
import os
import re

from tornado.web import StaticFileHandler
from config.environments import Environment

HASH_RE = re.compile(r"\.[a-f0-9]{8,}\.")

class CustomStaticFileHandler(StaticFileHandler):

    def set_extra_headers(self, path):
        # Always base headers on the ORIGINAL requested path (not .br/.gz)
        original = getattr(self, "_original_path", path)

        # Cache control
        if (
            not Environment.DEBUG
            and HASH_RE.search(original)
            and original.endswith((".js", ".mjs", ".css", ".woff2", ".svg"))
        ):
            self.set_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.set_header("Cache-Control", "no-store")
            self.set_header("Pragma", "no-cache")
            self.set_header("Expires", "0")

        self.set_header("Vary", "Accept-Encoding")

        encoding = getattr(self, "_encoding", None)
        if encoding:
            self.set_header("Content-Encoding", encoding)

        # ✅ CRITICAL: force Content-Type based on ORIGINAL extension
        mime, _ = mimetypes.guess_type(original)
        if mime is None:
            if original.endswith(".css"):
                mime = "text/css; charset=utf-8"
            elif original.endswith((".js", ".mjs")):
                mime = "application/javascript; charset=utf-8"
            else:
                mime = "application/octet-stream"

        self.set_header("Content-Type", mime)

    async def get(self, path, include_body=True):
        base_path = os.path.join(self.root, path)
        ae = self.request.headers.get("Accept-Encoding", "")

        file_to_serve = path
        encoding = None

        # Prefer br over gzip
        if "br" in ae and os.path.exists(base_path + ".br"):
            file_to_serve = path + ".br"
            encoding = "br"
        elif "gzip" in ae and os.path.exists(base_path + ".gz"):
            file_to_serve = path + ".gz"
            encoding = "gzip"

        self._original_path = path
        self._encoding = encoding

        await super().get(file_to_serve, include_body)
