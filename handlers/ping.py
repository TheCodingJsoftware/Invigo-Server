import os
import socket
import time
from typing import Any, Dict

from tornado.web import HTTPError

from handlers.base import BaseHandler


class PingHandler(BaseHandler):
    """
    Liveness probe.

    Purpose:
    - Confirms the HTTP stack + event loop are alive
    - Must never block
    - Must never touch external dependencies
    """

    _START_MONOTONIC = time.monotonic()

    async def get(self) -> None:
        try:
            payload: Dict[str, Any] = {
                "status": "ok",
                "type": "liveness",
                "service": "api",
                "timestamp": time.time(),
                "uptime_seconds": round(time.monotonic() - self._START_MONOTONIC, 3),
                "process": {
                    "pid": os.getpid(),
                    "hostname": socket.gethostname(),
                },
            }

            self.set_status(200)
            self.set_header("Content-Type", "application/json; charset=utf-8")
            self.set_header("Cache-Control", "no-store")
            self.finish(payload)

        except Exception:
            raise HTTPError(500)
