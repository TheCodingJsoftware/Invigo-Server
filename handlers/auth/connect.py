import logging
import os
from datetime import datetime

import msgspec
from filelock import FileLock, Timeout

from config.environments import Environment
from handlers.base import BaseHandler


class ConnectHandler(BaseHandler):
    def post(self):
        client_ip = str(self.request.remote_ip)
        client_data = msgspec.json.decode(self.request.body)
        client_name = client_data.get("client_name", "")
        latest_version = client_data.get("version")
        logging.info(f"{client_name} with version {latest_version} connected")

        file_path = os.path.join(Environment.DATA_PATH, "users.json")
        lock = FileLock(
            f"{file_path}.lock", timeout=10
        )  # Set a timeout for acquiring the lock
        try:
            with lock:
                if os.path.exists(file_path):
                    with open(
                        file_path,
                        "rb",
                    ) as file:
                        data = msgspec.json.decode(file.read())
                else:
                    data = {}

                # Update or set the client's information
                data.setdefault(
                    client_name,
                    {
                        "ip": client_ip,
                        "trusted": False,
                        "latest_version": latest_version,
                        "latest_connection": datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        ),
                    },
                )
                data[client_name].update({"ip": client_ip})
                data[client_name].update({"latest_version": latest_version})
                data[client_name].update(
                    {"latest_connection": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
                )

                with open(file_path, "wb") as file:
                    file.write(msgspec.json.encode(data))

            # Send a success response back to the client
            self.write(
                {"status": "success", "message": "Client data updated successfully."}
            )

        except FileNotFoundError:
            self.set_status(404)
            self.write(f'File "{file_path}" not found.')
        except Timeout:
            self.set_status(503)
            self.write(f"Could not acquire lock for {file_path}. Try again later.")
