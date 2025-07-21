from handlers.base import BaseHandler


class WorkspaceHandler(BaseHandler):
    async def get(self):
        await self.workspace_db._create_table_if_not_exists()
        self.render_template("workspace.html")
