from tornado.websocket import WebSocketHandler


class WorkspaceWebSocketHandler(WebSocketHandler):
    def open(self, *args, **kwargs):
        self.application.notifier.register_ws(self)

    def on_close(self):
        self.application.notifier.unregister_ws(self)

    def check_origin(self, origin):
        return True
