from handlers.base import BaseHandler


class PageHandler(BaseHandler):
    def initialize(
        self,
        template_name: str,
        extra_context: dict | None = None,
    ):
        self.template_name = template_name
        self.extra_context = extra_context or {}

    def get(self):
        self.render_template(self.template_name, **self.extra_context)
