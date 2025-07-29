import json

from tornado.web import HTTPError

from handlers.base import BaseHandler


class WorkspaceUpdateGroupHandler(BaseHandler):
    async def post(self):
        try:
            body = self.request.body.decode("utf-8")
            data = json.loads(body)

            group_id = data.get("group_id")
            field = data.get("field")
            value = data.get("value")

            if group_id is None or field is None:
                raise HTTPError(400, reason="Missing required fields")

            await self.workspace_db.update_grouped_laser_cut_parts(group_id, field, value)

            self.write({"status": "success"})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "detail": str(e)})
