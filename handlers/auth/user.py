import json

from handlers.base import BaseHandler


class UserHandler(BaseHandler):
    async def get(self, user_id=None):
        if user_id:
            user = await self.users_db.get_user(int(user_id))
            if user:
                self.write(dict(user))
            else:
                self.set_status(404)
                self.write({"error": "User not found"})
        else:
            users = await self.users_db.list_users()
            self.write([dict(u) for u in users])

    async def post(self):
        data = json.loads(self.request.body)
        name = data["name"]
        password = data["password"]
        roles = data["roles"]
        await self.users_db.add_user(name, password, roles)
        self.set_status(201)
        self.finish()

    async def put(self, user_id):
        data = json.loads(self.request.body)
        await self.users_db.update_user(
            int(user_id),
            name=data.get("name"),
            password=data.get("password"),
            role_names=data.get("roles"),
        )
        self.set_status(204)
        self.finish()

    async def delete(self, user_id):
        await self.users_db.delete_user(int(user_id))
        self.set_status(204)
        self.finish()
