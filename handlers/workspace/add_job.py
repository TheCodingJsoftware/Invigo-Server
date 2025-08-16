import logging
import time

import msgspec
from tornado.ioloop import IOLoop

from handlers.base import BaseHandler


class WorkspaceAddJobHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)

            IOLoop.current().spawn_callback(self._add_job_background, data)

            self.set_header("Content-Type", "application/json")
            self.write({"status": "processing", "message": "Job queued."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})

    async def _add_job_background(self, data):
        try:
            t0 = time.perf_counter()
            print(f"Job creation: {time.perf_counter() - t0:.2f}s")
            t1 = time.perf_counter()
            await self.workspace_db.add_job(data)
            print(f"Job insertion: {time.perf_counter() - t1:.2f}s")
        except Exception as e:
            print(f"Error adding job: {e}")
            logging.error(f"Error adding job in background: {e}")
