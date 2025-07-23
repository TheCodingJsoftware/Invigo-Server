import json

from handlers.base import BaseHandler


class LoginHandler(BaseHandler):
    async def post(self):
        data = json.loads(self.request.body)
        name = data["name"]
        password = data["password"]

        user = await self.users_db.authenticate_user(name, password)
        if not user:
            self.set_status(401)
            self.write({"error": "Invalid credentials"})
            return

        self.set_secure_cookie("user", json.dumps(user), httponly=True)
        self.set_status(200)
        self.write({"message": "Login successful", "user": user, "success": True})
