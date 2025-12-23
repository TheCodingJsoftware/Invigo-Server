

from handlers.base import BaseHandler


class GetNestWorkorderHandler(BaseHandler):
    async def get(self, workorder_id, nest_name):
        print(f"Fetching nest '{nest_name}' from workorder ID {workorder_id}")
        workorder = await self.workorders_db.get_workorder_by_id(int(workorder_id))
        nest = None
        for _nest in workorder["nests"]:
            if _nest["name"] == nest_name:
                nest = _nest
                break

        if not nest:
            self.set_status(404)
            self.finish({"error": "Nest not found"})
            return

        if not workorder:
            self.set_status(404)
            self.finish({"error": "Workorder not found"})
            return

        self.finish(nest)