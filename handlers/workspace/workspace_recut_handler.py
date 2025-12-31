import json

from handlers.base import BaseHandler


class RecutPartHandler(BaseHandler):
    async def post(self):
        try:
            data = self.request.body.decode("utf-8")
            data = json.loads(data)
            job_id = int(data.get("job_id")) if data.get("job_id") else None
            name = data.get("name")
            flowtag = data.get("flowtag")
            flowtag_index = data.get("flowtag_index")
            flowtag_status_index = data.get("flowtag_status_index")
            recut_quantity = data.get("recut_quantity")
            recut_reason = data.get("recut_reason")

            automated_text = f"({self.get_client_name_from_header()} is responsible for this change. Part was recut at {flowtag[flowtag_index]})"

            if recut_reason:
                recut_reason = recut_reason + "\n" + automated_text
            else:
                recut_reason = automated_text

            await self.view_db.handle_recut(
                name=name,
                flowtag=flowtag,
                flowtag_index=int(flowtag_index),
                flowtag_status_index=int(flowtag_status_index),
                recut_quantity=int(recut_quantity),
                recut_reason=recut_reason,
                changed_by=self.get_client_name_from_header(),
                user_id=self.get_user_id_from_header(),
                job_id=job_id,
            )
            self.write({"status": "ok"})
        except Exception as e:
            self.set_status(500)
            self.write({"error": str(e)})
