from tornado.web import RequestHandler


class LogoutHandler(RequestHandler):
    def post(self):
        self.clear_cookie("user")
        self.set_status(204)  # No Content
