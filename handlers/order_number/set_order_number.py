import logging
import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class SetOrderNumberHandler(BaseHandler):
    def post(self, order_number):
        try:
            order_number = int(order_number)
            file_path = os.path.join(Environment.DATA_PATH, "order_number.json")
            if os.path.exists(file_path):
                with open(file_path, "rb") as file:
                    json_file = msgspec.json.decode(file.read())
            else:
                json_file = {}

            json_file["order_number"] = order_number
            with open(file_path, "wb") as file:
                file.write(msgspec.json.encode(json_file))

            logging.info(
                f"{self.request.remote_ip} set order number to {order_number})",
            )
            self.write("Order number updated successfully.")
        except Exception as e:
            self.set_status(500)
            self.write(f"Failed to set order number: {str(e)}")
