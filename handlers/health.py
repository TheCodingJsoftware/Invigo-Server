import time
from typing import Any, Dict

from tornado.web import HTTPError

from handlers.base import BaseHandler
from utils.decorators.connection import BaseWithDBPool


class HealthHandler(BaseHandler):
    """
    Readiness probe.

    - Verifies all database dependencies
    - Fails fast per dependency
    - Returns structured, machine-readable status
    """

    async def get(self) -> None:
        try:
            checks: Dict[str, Dict[str, Any]] = {}

            # Iterate over all attributes on BaseHandler
            for attr_name in dir(self):
                if attr_name.startswith("_"):
                    continue

                attr = getattr(self, attr_name, None)

                # Only include DBs
                if isinstance(attr, BaseWithDBPool):
                    try:
                        await attr.ping()
                        checks[attr_name] = {"status": "ok"}
                    except Exception as e:
                        checks[attr_name] = {
                            "status": "error",
                            "detail": str(e),
                        }

            healthy = all(check["status"] == "ok" for check in checks.values())

            payload: Dict[str, Any] = {
                "status": "ok" if healthy else "degraded",
                "type": "readiness",
                "timestamp": time.time(),
                "checks": checks,
            }

            self.set_status(200 if healthy else 503)
            self.set_header("Content-Type", "application/json; charset=utf-8")
            self.set_header("Pragma", "no-cache")
            self.set_header(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0",
            )
            self.finish(payload)

        except Exception:
            raise HTTPError(500)
