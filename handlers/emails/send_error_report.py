import os
from datetime import datetime
from urllib.parse import quote

from config.environments import Environment
from handlers.base import BaseHandler
from utils.send_email import send_error_log


class SendErrorReportHandler(BaseHandler):
    def post(self):
        error_log = self.get_argument("error_log")
        client_name = self.get_client_name_from_header()
        if error_log is not None:
            self.save_and_send_error_log(client_name, error_log)
        else:
            self.set_status(400)

    def save_and_send_error_log(self, client_name, error_log):
        try:
            log_file_name = f"{client_name} - Error Log - {datetime.now().strftime('%B %d %A %Y %I_%M_%S %p')}.log"
            error_log_url = f"http://invi.go/logs#{quote(log_file_name, safe='')}"
            html_error_log_url = f'<a href="{error_log_url}">Error Log</a>'
            os.makedirs(f"{Environment.DATA_PATH}/logs", exist_ok=True)
            with open(
                f"{Environment.DATA_PATH}/logs/{log_file_name}",
                "w",
                encoding="utf-8",
            ) as error_file:
                error_file.write(error_log)

            send_error_log(
                body=f"{html_error_log_url}\n{error_log}",
            )
            self.set_status(200)
            self.write({"status": "success", "message": "Email sent successfully."})
        except Exception:
            self.set_status(500)
            self.write_error(500)
