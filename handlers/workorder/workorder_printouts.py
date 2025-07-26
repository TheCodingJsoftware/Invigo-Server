from handlers.base import BaseHandler


class WorkordersPageHandler(BaseHandler):
    async def get(self):
        all_workorders = await self.workorders_db.get_all_workorders()
        all_workorders = sorted(all_workorders, key=lambda wo: wo["id"], reverse=True)
        self.render_template("workorder_printouts.html", all_workorders=all_workorders)
