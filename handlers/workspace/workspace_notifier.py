import asyncpg
from tornado.ioloop import IOLoop


class WorkspaceNotifier:
    def __init__(self):
        self.listeners = set()

    async def start(self):
        self.conn = await asyncpg.connect(...)
        await self.conn.add_listener("workspace_updates", self._on_notify)

    def register_ws(self, ws):
        self.listeners.add(ws)

    def unregister_ws(self, ws):
        self.listeners.discard(ws)

    async def _on_notify(self, connection, pid, channel, payload):
        for ws in self.listeners:
            await ws.write_message(payload)
