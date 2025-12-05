from tornado.websocket import WebSocketHandler


class WorkspaceWebSocketHandler(WebSocketHandler):
    def open(self, *args, **kwargs):
        self.application.notifier.register_ws(self)

    def on_message(self, message):
        try:
            data = json.loads(message)
        except Exception:
            return
        if data.get("type") == "ping":
            self.write_message({"type": "pong"})

    def on_close(self):
        self.application.notifier.unregister_ws(self)

    def check_origin(self, origin):
        return True
