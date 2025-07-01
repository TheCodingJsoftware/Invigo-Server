from tornado.web import StaticFileHandler


class CustomStaticFileHandler(StaticFileHandler):
    def prepare(self):
        self.set_header("Cache-Control", "public, max-age=604800, immutable")
