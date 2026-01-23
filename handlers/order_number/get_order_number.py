import logging

from handlers.base import BaseHandler


class GetOrderNumberHandler(BaseHandler):
    def set_default_headers(self):
        # Prevent any client/proxy/CDN caching
        self.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.set_header("Pragma", "no-cache")  # legacy HTTP/1.0
        self.set_header("Expires", "0")

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
