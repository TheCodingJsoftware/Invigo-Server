import os
from urllib.parse import unquote

from config.environments import Environment
from handlers.base import BaseHandler


class WorkspaceFileReceiverHandler(BaseHandler):
    def get(self, file_name: str):
        try:
            file_name = unquote(file_name).replace("\\", "/")
            file_name = os.path.basename(os.path.normpath(file_name))

            file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
            filepath = os.path.join(
                Environment.DATA_PATH,
                "data",
                "workspace",
                file_ext,
                file_name,
            )

            if not os.path.exists(filepath):
                self.set_status(404)
                return

            stat = os.stat(filepath)
            etag = f"{stat.st_mtime_ns}-{stat.st_size}"

            if self.request.headers.get("If-None-Match") == etag:
                self.set_status(304)
                return

            if file_ext == "PDF":
                content_type = "application/pdf"
                disposition = "inline"
            elif file_ext == "JSON":
                content_type = "application/json"
                disposition = "inline"
            elif file_ext == "PNG":
                content_type = "image/png"
                disposition = "inline"
            elif file_ext in ("JPG", "JPEG"):
                content_type = "image/jpeg"
                disposition = "inline"
            elif file_ext == "DXF":
                content_type = "application/dxf"
                disposition = "attachment"
            else:
                content_type = "application/octet-stream"
                disposition = "attachment"

            self.set_header("Content-Type", content_type)
            self.set_header(
                "Content-Disposition",
                f'{disposition}; filename="{file_name}"',
            )
            self.set_header(
                "Cache-Control",
                "private, max-age=300, must-revalidate",
            )
            self.set_header("ETag", etag)

            with open(filepath, "rb") as f:
                self.write(f.read())

        except Exception:
            self.set_status(500)

        finally:
            self.finish()
