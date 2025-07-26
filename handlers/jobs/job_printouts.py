from handlers.base import BaseHandler
from utils.workspace.job import JobStatus

JobColors = {"planning": "#dbc90a", "quoting": "#bcdc77", "quoted": "#77dc77", "quote_confirmed": "#77dccd", "template": "#ffb870", "workspace": "#9ecaff", "archive": "#d3bbff"}


class JobsPageHandler(BaseHandler):
    async def get(self):
        all_jobs = await self.jobs_db.get_all_jobs()
        # sort jobs by order number
        all_jobs = sorted(all_jobs, key=lambda job: job["job_data"]["order_number"], reverse=True)
        all_job_statuses = {job["status"] for job in all_jobs}
        status_lookup = {status.value: status.name.replace("_", " ").title() for status in JobStatus}
        self.render_template("job_printouts.html", all_job_statuses=all_job_statuses, all_jobs=all_jobs, status_lookup=status_lookup, JobColors=JobColors)
