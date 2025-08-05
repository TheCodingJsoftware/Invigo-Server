import asyncio
import base64
import json
import logging
import os
import tempfile
import traceback

import tornado

from handlers.base import BaseHandler
from utils.send_email import send_purchase_order_email


class EmailPurchaseOrderHandler(BaseHandler):
    async def post(self):
        data = tornado.escape.json_decode(self.request.body)
        to = data["to"]
        cc = data.get("cc", "")
        subject = data["subject"]
        body = data["body"]
        page_url = data["pageUrl"]
        local_storage = data.get("localStorage", {})
        sender_email = data["senderEmail"]
        encrypted_password = data["encryptedPassword"]

        encoded = base64.urlsafe_b64encode(json.dumps(local_storage).encode()).decode()
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(tmp_fd)

        try:
            proc = await asyncio.create_subprocess_exec(
                "node", "scripts/generate-pdf.js", page_url, tmp_path, encoded, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                self.set_status(500)
                self.write("PDF generation failed:\n" + stderr.decode())
                return

            with open(tmp_path, "rb") as f:
                pdf_data = f.read()

            send_purchase_order_email(
                sender_email=sender_email,
                encrypted_password=encrypted_password,
                subject=subject,
                body=body,
                recipients=to,
                attachment=pdf_data,
                attachment_filename=f"{subject}.pdf",
                cc=cc,
            )

            self.set_status(200)
            self.write("Email sent.")
        except Exception as e:
            logging.exception(traceback.format_exc())
            self.set_status(500)
            self.write(f"Email send failed: {e}")
        finally:
            os.remove(tmp_path)
