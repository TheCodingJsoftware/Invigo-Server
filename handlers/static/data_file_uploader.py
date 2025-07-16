import logging
import os

from filelock import FileLock, Timeout

from config.environments import Environment
from handlers.base import BaseHandler


class FileUploadHandler(BaseHandler):
    def post(self):
        file_info = self.request.files.get("file")
        should_signal_connect_clients = False
        if file_info:
            file_data = file_info[0]["body"]
            filename: str = file_info[0]["filename"]

            if filename.lower().endswith(".json"):
                file_path = os.path.join(Environment.DATA_PATH, "data", filename)
                lock_path = f"{file_path}.lock"
                lock = FileLock(lock_path, timeout=10)
                try:
                    with lock:
                        with open(file_path, "wb") as file:
                            file.write(file_data)
                        # threading.Thread(
                        #     target=update_inventory_file_to_pinecone, args=(filename,)
                        # ).start()
                        should_signal_connect_clients = True

                    logging.info(
                        f'{self.request.remote_ip} uploaded "{filename}"',
                    )

                    if should_signal_connect_clients:
                        self.signal_clients_for_changes(
                            self.get_client_name_from_header(),
                            [filename],
                            client_type="software",
                        )
                        self.signal_clients_for_changes(None, [filename], client_type="web")
                except Timeout:
                    logging.info(
                        f'{self.request.remote_ip} Could not acquire lock for "{filename}".',
                    )
                    self.set_status(503)
                    self.write(f"Could not acquire lock for {filename}. Try again later.")
            elif filename.lower().endswith((".jpeg", ".jpg", ".png")):
                filename = os.path.basename(filename)
                with open(f"images/{filename}", "wb") as file:
                    file.write(file_data)
        else:
            self.write("No file received.")
            logging.info(
                f"No file received from {self.request.remote_ip}.",
            )
