import json

from handlers.base import BaseHandler


class RegisterPageHandler(BaseHandler):
    async def get(self):
        userCanRegister = False
        roles = await self.roles_db.get_all_roles()
        if raw := self.get_secure_cookie("user"):
            if user_id := json.loads(raw.decode()):
                if user := await self.users_db.get_user(user_id):
                    userCanRegister = "assign_roles" in dict(user)["permissions"]
        self.render_template("register.html", roles=roles, userCanRegister=userCanRegister)
