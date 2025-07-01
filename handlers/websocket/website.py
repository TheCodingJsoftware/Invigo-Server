from tornado.websocket import WebSocketHandler

import config.variables as variables


class WebSocketWebsiteHandler(WebSocketHandler):
    def open(self, *args: str, **kwargs: str):
        variables.website_connected_clients.add(self)

    def on_close(self):
        variables.website_connected_clients.remove(self)
