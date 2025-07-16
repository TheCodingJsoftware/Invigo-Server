from handlers.base import BaseHandler


class IsClientTrustedHandler(BaseHandler):
    def get(self):
        client_ip = str(self.request.remote_ip)
        self.write({"status": "success", "is_trusted": self.is_client_trusted(client_ip)})
