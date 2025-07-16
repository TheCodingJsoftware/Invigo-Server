import asyncio
import logging

import msgspec

from handlers.base import BaseHandler


class EntryUpdate(msgspec.Struct):
    id: int
    type: str  # Optional: for logging/debug
    data: dict


class WorkspaceBulkUpdateEntriesHandler(BaseHandler):
    async def post(self):
        try:
            updates = msgspec.json.decode(self.request.body, type=list[EntryUpdate])

            update_payload = [(entry.id, msgspec.json.encode(entry.data).decode()) for entry in updates]

            updated_ids, job_name_map = await self.workspace_db.bulk_update_entries(update_payload)

            logging.info(f"{self.request.remote_ip} updated {len(updated_ids)} entries")

            # Invalidate and notify
            await self.workspace_db.invalidate_entries_cache_bulk([e.id for e in updates if e.id in updated_ids])
            self.workspace_db._cache_refresh_queue.update(job_name_map.keys())
            asyncio.create_task(self.workspace_db._warm_cache())
            self.set_header("Content-Type", "application/json")
            self.write(
                {
                    "status": "success",
                    "updated": updated_ids,
                    "job_name_map": job_name_map,
                    "failed": [e.id for e in updates if e.id not in updated_ids],
                }
            )

            request_urls = [f"/workspace/get_entries_by_name/{job_id}/{name}" for job_id, name_set in job_name_map.items() for name in name_set]

            self.signal_clients_for_changes(self.get_client_name_from_header(), request_urls)

        except Exception as e:
            logging.info(f"Error updating entries: {e}")
            self.set_status(400)
            self.write({"error": str(e)})
