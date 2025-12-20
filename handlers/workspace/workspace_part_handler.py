import json
import logging
import traceback
from datetime import date, datetime
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
    def write_json(self, payload, status: int = 200):
        """
        Safely write JSON responses.
        - Converts datetime/date to ISO 8601
        - Sets correct headers
        - Prevents Tornado json serialization crashes
        """
        self.set_status(status)
        self.set_header("Content-Type", "application/json")

        self.finish(json.dumps(payload, default=self._json_default))

    @staticmethod
    def _json_default(obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

    async def get(self):
        job_id = int(self.get_argument("job_id"))
        name = self.get_argument("name")

        flowtag_arg = self.get_argument("flowtag", None)
        flowtag = flowtag_arg.split(",") if flowtag_arg else None

        flowtag_index_arg = self.get_argument("flowtag_index", None)
        flowtag_index = int(flowtag_index_arg) if flowtag_index_arg is not None else None

        flowtag_status_index_arg = self.get_argument("flowtag_status_index", None)
        flowtag_status_index = int(flowtag_status_index_arg) if flowtag_status_index_arg is not None else None

        data_type = self.get_argument("data_type", None)

        try:
            data = await self.view_db.find(
                job_id=job_id,
                name=name,
                flowtag=flowtag,
                flowtag_index=flowtag_index,
                flowtag_status_index=flowtag_status_index,
                data_type=data_type,
            )
            self.write_json({"data": data})

        except ValueError as e:
            logging.error(traceback.format_exc())
            self.send_error(400, reason=str(e))
        except Exception as e:
            logging.error(traceback.format_exc())
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
