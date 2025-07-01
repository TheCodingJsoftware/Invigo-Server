from tornado.websocket import WebSocketHandler

software_connected_clients: set[WebSocketHandler] = set()
website_connected_clients: set[WebSocketHandler] = set()
