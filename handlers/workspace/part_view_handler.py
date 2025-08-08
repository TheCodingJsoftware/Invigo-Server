import logging
import traceback

import msgspec

from handlers.base import BaseHandler

PART_VIEW_WHITELIST = {
    "view_grouped_laser_cut_parts_by_job",
    "view_grouped_laser_cut_parts_global",
}


class PartViewDataHandler(BaseHandler):
    async def get(self, db_view: str):
        show_completed = int(self.get_argument("show_completed", "0"))
        tag_str = self.get_argument("tags", "")
        viewable_tags = [tag.strip() for tag in tag_str.split(",") if tag.strip()]

        if db_view not in PART_VIEW_WHITELIST:
            self.set_status(400)
            self.finish({"error": "Invalid view"})
            return
        try:
            data = await self.view_db.get_grouped_parts_view(db_view, show_completed, viewable_tags)
        except Exception as e:
            self.set_status(500)
            logging.error(f"Error getting grouped parts view: {e} {traceback.format_exc()}")
            self.finish({"error": str(e)})
            return
        self.set_header("Content-Type", "application/json")
        self.finish(msgspec.json.encode(data).decode())
