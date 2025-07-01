import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class GetJobDirectoriesInfoHandler(BaseHandler):
    async def get(self):
        directories_info = await self.job_directory_cache.gather(
            base_directory=f"{Environment.DATA_PATH}/saved_jobs",
            specific_dirs=[
                "planning",
                "quoting",
                "quoted",
                "quote_confirmed",
                "template",
            ],
        )
        self.set_header("Content-Type", "application/json")
        self.write(msgspec.json.encode(directories_info))
