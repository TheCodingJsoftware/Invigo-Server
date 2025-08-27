import json

import tornado

from handlers.base import BaseHandler


class JobTimelineHandler(BaseHandler):
    async def get(self, job_id: str | None = None):
        if isinstance(job_id, str):
            job_id = int(job_id)

        self.set_header("Content-Type", "application/json")
        data = await self.workspace_db.get_job_timeline(job_id)
        self.write(data)

    async def post(self):
        data = tornado.escape.json_decode(self.request.body)
        for job_entry in data:
            job_id = job_entry["id"]
            flowtag_timeline = job_entry["flowtag_timeline"]

            # convert to JSON string for PostgreSQL
            flowtag_json = json.dumps(flowtag_timeline)

            await self.workspace_db.save_job_flowtag_timeline(job_id, flowtag_json)

        self.set_header("Content-Type", "application/json")
        self.write({"status": "ok"})
