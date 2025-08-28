import mimetypes
import os

from tornado.web import StaticFileHandler


class CustomStaticFileHandler(StaticFileHandler):
    def prepare(self):
        pass

    def set_extra_headers(self, _path):
        self.set_header("Cache-Control", "public, max-age=604800, immutable")
        self.set_header("Vary", "Accept-Encoding")
        if getattr(self, "_encoding", None):
            self.set_header("Content-Encoding", self._encoding)
        mime = mimetypes.guess_type(self._original_path)[0]
        if mime is None:
            if self._original_path.endswith(".css"):
                mime = "text/css"
            elif self._original_path.endswith(".js"):
                mime = "application/javascript"
            else:
                mime = "application/octet-stream"
        self.set_header("Content-Type", mime)

    async def get(self, path, include_body=True):
        base_path = os.path.join(self.root, path)
        accept_encoding = self.request.headers.get("Accept-Encoding", "")

        file_to_serve = path
        encoding = None

        if "br" in accept_encoding and os.path.exists(base_path + ".br"):
            file_to_serve = path + ".br"
            encoding = "br"
        elif "gzip" in accept_encoding and os.path.exists(base_path + ".gz"):
            file_to_serve = path + ".gz"
            encoding = "gzip"

        self._original_path = path
        self._encoding = encoding

        await super().get(file_to_serve, include_body)
