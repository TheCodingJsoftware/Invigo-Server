import os
from tornado.web import RequestHandler, HTTPError

from utils.database.software_db import SoftwareDB
from config.environments import Environment

class BaseSoftwareHandler(RequestHandler):
    db = SoftwareDB()

    def set_default_headers(self):
        self.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.set_header("Pragma", "no-cache")
        self.set_header("Expires", "0")
        self.set_header("Surrogate-Control", "no-store")



class SoftwareVersionHandler(BaseSoftwareHandler):
    async def get(self):
        row = await self.db.get_latest_version()

        if not row:
            raise HTTPError(404)

        self.write({
            "version": row["version"],
            "file": os.path.basename(row["file_path"]),
            "uploaded_by": row["uploaded_by"],
            "changelog": row["changelog"],
            "created_at": row["created_at"].isoformat()
        })


class SoftwareUploadHandler(BaseSoftwareHandler):
    async def post(self):
        if "file" not in self.request.files:
            raise HTTPError(400, "file missing")

        version = self.get_argument("version")
        uploaded_by = self.get_argument("uploaded_by")
        changelog = self.get_argument("changelog", "")

        if not version or not uploaded_by:
            raise HTTPError(400, "version and uploaded_by required")

        fileinfo = self.request.files["file"][0]

        upload_dir = os.path.join(Environment.DATA_PATH, "software")
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"Invigo-{version}.zip"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as f:
            f.write(fileinfo["body"])


        await self.db.add_version(version, file_path, uploaded_by, changelog)

        self.write({
            "status": "ok",
            "version": version,
            "file": filename,
        })


class SoftwareUpdateHandler(BaseSoftwareHandler):
    def set_default_headers(self):
        self.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.set_header("Pragma", "no-cache")      # HTTP/1.0 proxies
        self.set_header("Expires", "0")             # Absolute kill-switch
        self.set_header("Surrogate-Control", "no-store")

    async def get(self):
        version = self.get_argument("version", None)

        data = await self.db.get_version(version) if version else await self.db.get_latest_version()

        if not data:
            raise HTTPError(404)

        file_path = data["file_path"]

        self.set_header("Content-Length", os.path.getsize(file_path))
        self.set_header("Content-Type", "application/octet-stream")
        self.set_header(
            "Content-Disposition",
            'attachment; filename="Invigo.zip"',
        )

        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(4 * 1024 * 1024)
                if not chunk:
                    break
                self.write(chunk)
                await self.flush()
        await self.finish()