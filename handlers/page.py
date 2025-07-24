from handlers.base import BaseHandler


class PageHandler(BaseHandler):
    def initialize(
        self,
        template_name: str,
        extra_context: dict | None = None,
    ):
        self.template_name = template_name
        self.extra_context = extra_context or {}

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")  # Or specify domains
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def options(self):
        # For preflight requests
        self.set_status(204)
        self.finish()

    def get(self):
        self.render_template(self.template_name, **self.extra_context)
