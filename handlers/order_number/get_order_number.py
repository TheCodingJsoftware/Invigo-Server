import logging

from handlers.base import BaseHandler


class GetOrderNumberHandler(BaseHandler):
    async def get(self):
        jobs_info = await self.jobs_db.get_all_jobs()

        max_order_number = 0
        next_order_number = 1

        for job in jobs_info:
            max_order_number = max(max_order_number, job["job_data"]["order_number"])

            next_order_number = max_order_number + 1

        logging.info(
            f"Sent order number ({next_order_number}) to {self.request.remote_ip}",
        )
        self.write({"order_number": next_order_number})
