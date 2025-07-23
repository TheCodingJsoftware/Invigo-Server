import json

from handlers.base import BaseHandler


class RoleAPIHandler(BaseHandler):
    async def get(self):
        roles = await self.roles_db.get_all_roles()
        self.write({"roles": roles})

    async def post(self):
        data = json.loads(self.request.body)
        await self.roles_db.create_or_update_role(data)
        self.set_status(204)

    async def delete(self):
        role_id = int(self.get_argument("id"))
        await self.roles_db.delete_role(role_id)
        self.set_status(204)
