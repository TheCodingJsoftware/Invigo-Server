import json

from handlers.base import BaseHandler


class RecutPartFinishedHandler(BaseHandler):
    async def post(self):
        try:
            data = self.request.body.decode("utf-8")
            data = json.loads(data)
            job_id = int(data.get("job_id")) if data.get("job_id") else None
            name = data.get("name")
            flowtag = data.get("flowtag")
            flowtag_index = data.get("flowtag_index")
            flowtag_status_index = data.get("flowtag_status_index")

            await self.view_db.handle_recut_finished(
                name=name,
                flowtag=flowtag,
                flowtag_index=int(flowtag_index),
                flowtag_status_index=int(flowtag_status_index),
                changed_by=self.get_client_name_from_header(),
                user_id=self.get_user_id_from_header(),
                job_id=job_id,
            )
            self.write({"status": "ok"})
        except Exception as e:
            self.set_status(500)
            self.write({"error": str(e)})
