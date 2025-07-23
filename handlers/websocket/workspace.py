import msgspec
from tornado.websocket import WebSocketHandler


class WebSocketWorkspaceHandler(WebSocketHandler):
    clients = set()

    def open(self, *args: str, **kwargs: str):
        WebSocketWorkspaceHandler.clients.add(self)

    def on_close(self):
        WebSocketWorkspaceHandler.clients.remove(self)

    @classmethod
    def broadcast(cls, message: dict):
        for client in cls.clients:
            client.write_message(msgspec.json.encode(message))
