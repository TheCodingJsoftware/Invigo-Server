import logging
import os

from filelock import FileLock, Timeout

from config.environments import Environment
from handlers.base import BaseHandler


class ProductionPlannerFileUploadHandler(BaseHandler):
    def post(self):
        file_info = self.request.files.get("file")
        if file_info:
            file_data = file_info[0]["body"]
            filename: str = file_info[0]["filename"]

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
            except Timeout:
                logging.error(
                    f'{self.request.remote_ip} Could not acquire lock for "{filename}".',
                )
                self.write(f"Could not acquire lock for {filename}. Try again later.")
                return

            logging.info(
                f'Web {self.request.remote_ip} uploaded "{filename}"',
            )
            self.signal_clients_for_changes(self.request.remote_ip, [filename], client_type="web")
        else:
            self.write("No file received.")
            logging.info(
                f"No file received from  {self.request.remote_ip}.",
            )
