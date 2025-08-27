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


class WorkspaceLaserCutPartHandler(BaseHandler):
    async def get(self):
        job_id = int(self.get_argument("job_id", -1))
        name = self.get_argument("name", "")
        flowtag = self.get_argument("flowtag", []).split(",")
        flowtag_index = self.get_argument("flowtag_index", -1)
        flowtag_status_index = self.get_argument("flowtag_status_index", -1)
        data_type = self.get_argument("data_type", None)

        try:
            data = await self.view_db.find(
                job_id=job_id,
                name=name,
                flowtag=flowtag,
                flowtag_index=int(flowtag_index),
                flowtag_status_index=int(flowtag_status_index),
                data_type=data_type,
            )
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

            job_id = int(data.get("job_id")) if data.get("job_id") else None
            name = data.get("name")
            flowtag = data.get("flowtag")
            flowtag_index = data.get("flowtag_index")
            flowtag_status_index = data.get("flowtag_status_index")
            data_type = data.get("data_type")
            new_value = data.get("new_value")

            if data_type == "flowtag_index":
                await self.view_db.update_flowtag_index(
                    name=name,
                    flowtag=flowtag,
                    flowtag_index=int(flowtag_index),
                    flowtag_status_index=int(flowtag_status_index),
                    new_index=int(new_value),
                    changed_by=self.get_client_name_from_header(),
                    job_id=job_id,
                )
                self.write({"status": "ok"})
            elif data_type == "flowtag_status_index":
                await self.view_db.update_flowtag_status_index(
                    name=name,
                    flowtag=flowtag,
                    flowtag_index=int(flowtag_index),
                    flowtag_status_index=int(flowtag_status_index),
                    new_status_index=int(new_value),
                    changed_by=self.get_client_name_from_header(),
                    job_id=job_id,
                )
                self.write({"status": "ok"})
            elif data_type == "is_timing":
                await self.view_db.update_is_timing(
                    name=name,
                    flowtag=flowtag,
                    flowtag_index=int(flowtag_index),
                    flowtag_status_index=int(flowtag_status_index),
                    is_timing=bool(new_value),
                    changed_by=self.get_client_name_from_header(),
                    job_id=job_id,
                )
                self.write({"status": "ok"})
            else:
                self.send_error(400, reason="Unsupported data_type")

        except ValueError as e:
            logging.error(traceback.format_exc())
            self.send_error(400, reason=str(e))
        except Exception as e:
            logging.error(traceback.format_exc())
            self.send_error(500, reason=str(e))
