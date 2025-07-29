import json

from handlers.base import BaseHandler


class UsersPageHandler(BaseHandler):
    async def get(self):
        userCanEditUsers = False
        users = await self.users_db.list_users()
        roles = await self.roles_db.get_all_roles()
        if raw := self.get_secure_cookie("user"):
            if user_id := json.loads(raw.decode()):
                if user := await self.users_db.get_user(user_id):
                    userCanEditUsers = "edit_users" in dict(user)["permissions"]
        self.render_template("users.html", users=users, roles=roles, canEditUsers=userCanEditUsers)
