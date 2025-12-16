from urllib.parse import urlencode

from handlers.base import BaseHandler


class WorkorderMarkComplete(BaseHandler):
    async def get(self, workorder_id: str):
        try:
            workorder_id = int(workorder_id)
            workorder = await self.workorders_db.get_workorder_by_id(workorder_id)
            if not workorder:
                self.set_status(404)
                self.write({"error": "Workorder not found"})
                return
            parts = self.workorders_db._extract_parts_with_quantity(workorder)
            result = await self.workspace_db.mark_workorder_parts_complete(
                parts=parts,
                changed_by=self.current_user,
            )
            params = urlencode({"title": "Workorder Updated", "message": f"Workorder {workorder_id} marked as complete.", "type": "success"})
            self.redirect(f"/message?{params}")
        except Exception as e:
            params = urlencode({"title": "Error", "message": f"Failed to mark workorder {workorder_id} as complete: {str(e)}", "type": "error"})
            self.redirect(f"/message?{params}")
