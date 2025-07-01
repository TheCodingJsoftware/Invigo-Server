from handlers.base import BaseHandler


class LoadJobPrintoutHandler(BaseHandler):
    async def get(self):
        self.render_template("job_printout.html")
