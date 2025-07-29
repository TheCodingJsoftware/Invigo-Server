import json

from handlers.base import BaseHandler


class ProtectedHandler(BaseHandler):
    def get_current_user(self):
        user_id = self.get_secure_cookie("user")
        return json.loads(user_id.decode()) if user_id else None

    async def get(self):
        user_id = self.current_user
        if not user_id:
            self.set_status(401)
            self.write({"error": "Unauthorized"})
            return

        # Fetch full user from DB
        full_user = await self.users_db.get_user(user_id)
        if not full_user:
            self.set_status(401)
            self.write({"error": "User not found"})
            return

        self.write(dict(full_user))
