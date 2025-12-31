import os
from tornado.web import RequestHandler, HTTPError

from utils.database.software_db import SoftwareDB
from config.environments import Environment


class SoftwareVersionHandler(RequestHandler):
    def initialize(self):
        self.db = SoftwareDB()

    async def get(self):
        await self.db.connect()
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


class SoftwareUploadHandler(RequestHandler):
    def initialize(self):
        self.db = SoftwareDB()

    async def post(self):
        await self.db.connect()

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


class SoftwareUpdateHandler(RequestHandler):
    def initialize(self):
        self.db = SoftwareDB()

    async def get(self):
        version = self.get_argument("version", None)

        await self.db.connect()
        data = await self.db.get_version(version) if version else await self.db.get_latest_version()

        if not data:
            raise HTTPError(404)

        file_path = data["file_path"]

        self.set_header("Content-Type", "application/octet-stream")
        self.set_header(
            "Content-Disposition",
            'attachment; filename="Invigo.zip"',
        )

        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                self.write(chunk)
                await self.flush()
