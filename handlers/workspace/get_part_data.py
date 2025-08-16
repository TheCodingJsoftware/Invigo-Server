import logging

import msgspec

from handlers.base import BaseHandler


class GetPartDataHandler(BaseHandler):
    async def get(self):
        view = self.get_argument("view", "global")
        job_id = self.get_argument("job_id", -1)
        group_id = self.get_argument("group_id", -1)
        name = self.get_argument("name", "")
        flowtag = self.get_argument("flowtag", []).split(",")
        flowtag_index = self.get_argument("flowtag_index", -1)
        flowtag_status_index = self.get_argument("flowtag_status_index", -1)
        data_type = self.get_argument("data_type", None)

        try:
            if "by_job" in view:
                if job_id:
                    data = await self.view_db.find_by_job(
                        job_id=int(job_id),
                        name=name,
                        flowtag=flowtag,
                        flowtag_index=int(flowtag_index),
                        flowtag_status_index=int(flowtag_status_index),
                        data_type=data_type,
                    )
                else:
                    self.send_error(400, reason="job_id is required for by_job view")
                    return
            else:  # global view
                data = await self.view_db.find_global(
                    name=name, flowtag=flowtag, flowtag_index=int(flowtag_index), flowtag_status_index=int(flowtag_status_index), data_type=data_type
                )

            self.write(msgspec.json.encode({"data": data}))
        except Exception as e:
            logging.error(f"Error fetching view data: {e}")
            self.send_error(500, reason=str(e))
