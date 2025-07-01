import asyncio
import functools
from typing import Awaitable, Callable, ParamSpec, TypeVar

import asyncpg

T = TypeVar("T", bound="BaseWithDBPool")
P = ParamSpec("P")


class BaseWithDBPool:
    db_pool: asyncpg.Pool | None

    async def connect(self) -> None:
        raise NotImplementedError


def ensure_connection(func: Callable[P, Awaitable]) -> Callable[P, Awaitable]:
    @functools.wraps(func)
    async def wrapper(self: BaseWithDBPool, *args: P.args, **kwargs: P.kwargs):
        retries = 3
        for i in range(retries):
            try:
                if self.db_pool is None or self.db_pool._closed:
                    await self.connect()
                return await func(self, *args, **kwargs)
            except (asyncpg.PostgresError, ConnectionError) as e:
                if i < retries - 1:
                    await asyncio.sleep(1 * (i + 1))
                else:
                    raise e

    return wrapper
