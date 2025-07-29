import msgspec

from handlers.base import BaseHandler

PART_VIEW_WHITELIST = {
    "view_grouped_laser_cut_parts_by_assembly",
    "view_grouped_laser_cut_parts_by_job",
    "view_grouped_laser_cut_parts_global",
}


class PartViewDataHandler(BaseHandler):
    async def get(self):
        view = self.get_argument("view")
        if view not in PART_VIEW_WHITELIST:
            self.set_status(400)
            self.finish({"error": "Invalid view"})
            return

        self.set_header("Content-Type", "application/json")
        self.write(msgspec.json.encode(await self.workspace_db.get_grouped_parts_view(view)))
