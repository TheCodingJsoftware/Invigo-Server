import io
import json
import os
import zipfile
from urllib.parse import unquote

from config.environments import Environment
from handlers.base import BaseHandler


class DownloadBundleHandler(BaseHandler):
    async def post(self):
        try:
            files = json.loads(self.get_body_argument("files"))

            if not isinstance(files, list) or not files:
                self.set_status(400)
                return

            self.set_header("Content-Type", "application/zip")
            self.set_header(
                "Content-Disposition",
                'attachment; filename="workspace-files.zip"',
            )
            self.set_header("Cache-Control", "no-store")

            buf = io.BytesIO()

            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for raw_name in files:
                    # ---- SAME SANITIZATION AS SINGLE FILE ----
                    file_name = unquote(raw_name).replace("\\", "/")
                    file_name = os.path.basename(os.path.normpath(file_name))

                    if not file_name:
                        continue

                    file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
                    if not file_ext:
                        continue

                    filepath = os.path.join(
                        Environment.DATA_PATH,
                        "data",
                        "workspace",
                        file_ext,
                        file_name,
                    )

                    if not os.path.exists(filepath):
                        continue  # silently skip missing files

                    # ---- ADD TO ZIP ----
                    zf.write(filepath, arcname=file_name)

            buf.seek(0)
            self.write(buf.read())

        except json.JSONDecodeError:
            self.set_status(400)

        except Exception:
            self.set_status(500)

        finally:
            self.finish()
