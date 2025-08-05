import json
import logging
import traceback
from enum import Enum

from handlers.base import BaseHandler


class PartDataType(Enum):
    WORKSPACE = "workspace_data"
    INVENTORY = "inventory_data"
    META = "meta_data"
    PRICES = "prices"
    PAINT = "paint_data"
    PRIMER = "primer_data"
    POWDER = "powder_data"


class WorkspacePartViewHandler(BaseHandler):
    async def get(self):
        view = self.get_argument("view", "global")
        job_id = self.get_argument("job_id", -1)
        name = self.get_argument("name", "")
        flowtag = self.get_argument("flowtag", []).split(",")
        flowtag_index = self.get_argument("flowtag_index", -1)
        data_type = self.get_argument("data_type", None)

        try:
            if "by_job" in view:
                if job_id:
                    data = await self.view_db.find_by_job(job_id=int(job_id), name=name, flowtag=flowtag, flowtag_index=int(flowtag_index), data_type=data_type)
                else:
                    self.send_error(400, reason="job_id is required for by_job view")
                    return
            else:  # global view
                data = await self.view_db.find_global(name=name, flowtag=flowtag, flowtag_index=int(flowtag_index), data_type=data_type)

            self.write({"data": data})

        except ValueError as e:
            logging.error(traceback.print_exc())
            self.send_error(400, reason=str(e))
        except Exception as e:
            logging.error(traceback.print_exc())
            self.send_error(500, reason=str(e))

    async def put(self):
        try:
            body = self.request.body.decode("utf-8")
            data = json.loads(body)

            view = data.get("view")
            job_id = data.get("job_id")
            name = data.get("name")
            flowtag = data.get("flowtag")
            flowtag_index = data.get("flowtag_index")
            data_type = data.get("data_type")
            new_value = data.get("new_value")

            if data_type == "flowtag_index":
                if "by_job" in view:
                    await self.view_db.update_flowtag_index_by_job(job_id=int(job_id), name=name, flowtag=flowtag, flowtag_index=int(flowtag_index), new_index=int(new_value))
                else:
                    await self.view_db.update_flowtag_index_global(name=name, flowtag=flowtag, flowtag_index=int(flowtag_index), new_index=int(new_value))
                self.write({"status": "ok"})
            else:
                self.send_error(400, reason="Unsupported data_type")

        except ValueError as e:
            logging.error(traceback.format_exc())
            self.send_error(400, reason=str(e))
        except Exception as e:
            logging.error(traceback.format_exc())
            self.send_error(500, reason=str(e))
