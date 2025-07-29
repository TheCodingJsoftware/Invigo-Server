import json

from handlers.base import BaseHandler


class RolesPageHandler(BaseHandler):
    async def get(self):
        userCanEditRoles = False
        if raw := self.get_secure_cookie("user"):
            if user_id := json.loads(raw.decode()):
                if user := await self.users_db.get_user(user_id):
                    userCanEditRoles = "edit_roles" in dict(user)["permissions"]
        roles = await self.roles_db.get_all_roles()
        self.render_template("roles.html", roles=roles, userCanEditRoles=userCanEditRoles)
