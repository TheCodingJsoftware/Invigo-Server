import logging

import msgspec

from handlers.base import BaseHandler


class WorkspaceGetEntriesByNamesHandler(BaseHandler):
    async def get(self, job_id, name: str):
        try:
            job_id = int(job_id)
            name = name.strip()

            entries = await self.workspace_db.get_cached_entries_by_name(job_id, name)

            logging.info(
                f"{self.request.remote_ip} requested {len(entries)} entries for name='{name}' under job={job_id}"
            )

            self.set_header("Content-Type", "application/json")
            self.write(msgspec.json.encode(entries))
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})
