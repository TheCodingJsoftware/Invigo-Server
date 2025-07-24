import asyncio
import base64
import json
import logging
import os
import tempfile

import tornado

from handlers.base import BaseHandler


class GeneratePDFHandler(BaseHandler):
    async def post(self):
        url = self.get_argument("url")
        body = tornado.escape.json_decode(self.request.body)
        local_storage = body.get("localStorage", {})

        encoded = base64.urlsafe_b64encode(json.dumps(local_storage).encode()).decode()
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(tmp_fd)

        script_path = os.path.join(os.path.dirname(__file__), "scripts", "generate-pdf.js")

        try:
            proc = await asyncio.create_subprocess_exec(
                "node",
                script_path,
                url,
                tmp_path,
                encoded,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode != 0:
                error_output = stderr.decode()
                logging.error(f"PDF generation failed for url {url}: {error_output}")
                self.set_status(500)
                self.write(f"PDF generation failed:\n{error_output}")
                return

            with open(tmp_path, "rb") as f:
                self.set_header("Content-Type", "application/pdf")
                self.set_header("Content-Disposition", "inline; filename=output.pdf")
                self.write(f.read())

        except Exception as e:
            logging.error(f"PDF generation error for url {url}: {e}")
            self.set_status(500)
            self.write(f"PDF generation error:\n{str(e)}")

        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
