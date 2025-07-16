import logging

from tornado.websocket import WebSocketHandler

import config.variables as variables


class WebSocketSoftwareHandler(WebSocketHandler):
    def open(self):
        self.client_name = self.get_query_argument("client_name", None)
        if not self.client_name:
            self.close(reason="Missing client_name")
            return

        variables.software_connected_clients.add(self)
        logging.info(f"Software WebSocket connected: {self.client_name} (IP: {self.request.remote_ip})")

    def on_close(self):
        if self in variables.software_connected_clients:
            variables.software_connected_clients.remove(self)
            logging.info(f"Software WebSocket disconnected: {self.client_name}")
