import logging
import os

from filelock import FileLock, Timeout

from config.environments import Environment
from handlers.base import BaseHandler


class FileUploadHandler(BaseHandler):
    def post(self):
        files = self.request.files.get("file")
        if not files:
            self.set_status(400)
            self.write("No file received.")
            logging.info(f"No file received from {self.request.remote_ip}.")
            return

        file_info = files[0]
        filename: str = os.path.basename(file_info["filename"]).strip()
        file_data = file_info["body"]
        ext = filename.lower().split(".")[-1]
        should_signal_connect_clients = False

        if ext == "json":
            file_path = os.path.join(Environment.DATA_PATH, "data", filename)
            lock = FileLock(f"{file_path}.lock", timeout=10)
            try:
                with lock:
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    with open(file_path, "wb") as f:
                        f.write(file_data)
                logging.info(f'{self.request.remote_ip} uploaded JSON file "{filename}"')
                should_signal_connect_clients = True
            except Timeout:
                self.set_status(503)
                self.write(f"Could not acquire lock for {filename}. Try again later.")
                logging.warning(f'{self.request.remote_ip} timeout on lock for "{filename}"')
                return
        elif ext in ("jpg", "jpeg", "png"):
            file_path = os.path.join(Environment.DATA_PATH, "images", filename)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(file_data)
            logging.info(f'{self.request.remote_ip} uploaded image "{filename}"')
        else:
            self.set_status(415)
            self.write(f"Unsupported file type: {ext}")
            logging.warning(f'{self.request.remote_ip} attempted upload of unsupported file: "{filename}"')
            return

        if should_signal_connect_clients:
            self.signal_clients_for_changes(
                self.get_client_name_from_header(),
                [filename],
                client_type="software",
            )
            self.signal_clients_for_changes(None, [filename], client_type="web")

        self.set_status(200)
        self.write(f"Uploaded {filename} successfully.")
