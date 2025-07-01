import logging

from config.environments import Environment
from handlers.base import BaseHandler


class GetOrderNumberHandler(BaseHandler):
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

        max_order_number = 0
        for _, job_data in directories_info.items():
            max_order_number = max(max_order_number, job_data["order_number"])

        next_order_number = max_order_number + 1

        logging.info(
            f"Sent order number ({next_order_number}) to {self.request.remote_ip}",
        )
        self.write({"order_number": next_order_number})
