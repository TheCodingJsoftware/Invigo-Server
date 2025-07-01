import asyncio
import logging
from datetime import datetime, timedelta
from typing import Callable


class InventoryCacheManager:
    def __init__(self, expiry_seconds=60):
        self.cache = {}
        self.expiry_seconds = expiry_seconds
        self._refresh_tasks = {}  # key -> (func, interval)
        self._stop = False
        self._task = None  # Start later

    def get(self, key):
        item = self.cache.get(key)
        if item:
            value, timestamp = item
            if datetime.now() - timestamp < timedelta(seconds=self.expiry_seconds):
                return value
        return None

    def set(self, key, value):
        self.cache[key] = (value, datetime.now())

    def invalidate(self, key_startswith):
        self.cache = {
            k: v for k, v in self.cache.items() if not k.startswith(key_startswith)
        }

    def schedule_refresh(self, key: str, func: Callable, interval: int | None = None):
        self._refresh_tasks[key] = (func, interval or self.expiry_seconds)

    async def start(self):
        if self._task is None:
            self._task = asyncio.create_task(self._worker())

    async def _worker(self):
        while not self._stop:
            for key, (func, interval) in self._refresh_tasks.items():
                try:
                    result = await func()
                    self.set(key, result)
                except Exception as e:
                    logging.info(f"[CacheManager] Failed to refresh key '{key}': {e}")
            await asyncio.sleep(self.expiry_seconds)

    async def stop(self):
        self._stop = True
        if self._task:
            await self._task

    async def shutdown(self):
        self.cache.clear()
        self._refresh_tasks.clear()
        self._stop = True
        self._task = None
        if self._task:
            self._task.cancel()
            self._task = None
