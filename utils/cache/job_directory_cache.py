import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import msgspec
from tornado.ioloop import IOLoop


class JobDirectoryCache:
    def __init__(self):
        self._cache = None
        self._cache_timestamp = None
        self.cache_expiry = timedelta(hours=1)
        self.executor = ThreadPoolExecutor(max_workers=4)

    def _is_cache_valid(self):
        return (
            self._cache is not None
            and self._cache_timestamp is not None
            and datetime.now() - self._cache_timestamp < self.cache_expiry
        )

    def invalidate_cache(self):
        self._cache = None
        self._cache_timestamp = None

    async def gather(self, base_directory: str, specific_dirs: list[str]):
        if self._is_cache_valid():
            return self._cache

        def blocking_io():
            gathered_data: dict[str, dict[str, str]] = {}
            for specific_dir in specific_dirs:
                specific_path: str = os.path.join(base_directory, specific_dir)
                for root, dirs, _ in os.walk(specific_path):
                    for dirname in dirs:
                        dir_path = os.path.join(root, dirname)
                        job_data_path = os.path.join(dir_path, "data.json")
                        try:
                            with open(job_data_path, "rb") as f:
                                job_data = msgspec.json.decode(f.read())

                            modified_timestamp = os.path.getmtime(job_data_path)
                            formatted_modified_date = datetime.fromtimestamp(
                                modified_timestamp
                            ).strftime("%Y-%m-%d %I:%M:%S %p")

                            dir_info = {
                                "dir": root.replace("\\", "/"),
                                "name": dirname,
                                "modified_date": modified_timestamp,
                                "formated_modified_date": formatted_modified_date,
                                "type": job_data["job_data"].get("type", 0),
                                "order_number": job_data["job_data"].get(
                                    "order_number", 0
                                ),
                                "ship_to": job_data["job_data"].get("ship_to", ""),
                                "date_shipped": job_data["job_data"].get(
                                    "starting_date", ""
                                ),
                                "date_expected": job_data["job_data"].get(
                                    "ending_date", ""
                                ),
                                "color": job_data["job_data"].get("color", ""),
                            }
                            relative_path = dir_path.replace(f"{base_directory}/", "")
                            gathered_data[relative_path] = dir_info
                        except Exception as e:
                            logging.error(f"Could not process {dir_path}: {str(e)}")
            return gathered_data

        self._cache = await IOLoop.current().run_in_executor(self.executor, blocking_io)
        self._cache_timestamp = datetime.now()
        return self._cache
