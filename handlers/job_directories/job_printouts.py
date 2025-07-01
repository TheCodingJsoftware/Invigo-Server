from handlers.base import BaseHandler
from utils.workspace.job import JobStatus


class JobDirectoryPrintoutsHandler(BaseHandler):
    async def get(self):
        all_jobs = await self.jobs_db.get_all_jobs()
        status_lookup = {
            status.value: status.name.replace("_", " ").title() for status in JobStatus
        }

        self.render_template(
            "job_printouts.html", all_jobs=all_jobs, status_lookup=status_lookup
        )
