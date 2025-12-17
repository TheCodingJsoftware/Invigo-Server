import os
from urllib.parse import unquote

from config.environments import Environment
from handlers.base import BaseHandler


class WorkspaceFileReceiverHandler(BaseHandler):
    def get(self, file_name: str):
        file_name = unquote(file_name).replace("\\", "/")
        normalized_path = os.path.normpath(file_name)
        file_name = os.path.basename(normalized_path)
        file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
        filepath = os.path.join(Environment.DATA_PATH, "data", "workspace", file_ext, file_name)

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
            # most browsers won't render DXF; serve as download
            content_type = "application/dxf"
            disposition = "attachment"
        else:
            content_type = "application/octet-stream"
            disposition = "attachment"

        self.set_header("Content-Type", content_type)
        self.set_header("Content-Disposition", f'{disposition}; filename="{file_name}"')

        if file_ext in ("PNG", "JPG", "JPEG", "PDF"):
            self.set_header("Cache-Control", "public, max-age=60")  # 60 seconds
        else:
            self.set_header("Cache-Control", "no-store")

        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                self.write(f.read())

        self.finish()
