from handlers.base import BaseHandler


class MessageHandler(BaseHandler):
    def get(self):
        self.render_template("message.html")
