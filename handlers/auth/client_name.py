from handlers.base import BaseHandler


class GetClientNameHandler(BaseHandler):
    def get(self):
        client_ip = str(self.request.remote_ip)
        client_name = self.get_client_name(client_ip)
        if client_name:
            self.set_status(200)
            self.write({"status": "success", "client_name": client_name})
        else:
            self.set_status(404)
            self.write({"status": "error", "message": "Trusted users file not found."})
