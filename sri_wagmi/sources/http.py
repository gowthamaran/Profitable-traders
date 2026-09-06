"""One shared aiohttp session with a concurrency gate and bounded retries.

Every upstream we touch is a free public endpoint, so we behave: modest
concurrency, honest user agent, no hammering on failure.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp

log = logging.getLogger(__name__)

USER_AGENT = "sri-wagmi/1.0 (+https://github.com/gowthamaran/Profitable-traders)"

# Cloudflare-fronted endpoints answer 403 to a plain client. That is not a bug
# to route around; it is a wall we report and move past.
BLOCKED_STATUSES = {401, 403, 451}


class FetchError(RuntimeError):
    """Upstream did not give us usable data."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status

    @property
    def blocked(self) -> bool:
        return self.status in BLOCKED_STATUSES


class HttpClient:
    def __init__(self, timeout_seconds: float = 15.0, max_concurrency: int = 8) -> None:
        self._timeout = aiohttp.ClientTimeout(total=timeout_seconds)
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> HttpClient:
        await self.start()
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.close()

    async def start(self) -> None:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=self._timeout,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )

    async def close(self) -> None:
        if self._session is not None and not self._session.closed:
            await self._session.close()
        self._session = None

    @property
    def session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            raise RuntimeError("HttpClient used before start()")
        return self._session

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        attempts: int = 3,
    ) -> Any:
        return await self._request_json("GET", url, params=params, headers=headers, attempts=attempts)

    async def post_json(
        self,
        url: str,
        *,
        payload: dict[str, Any],
        headers: dict[str, str] | None = None,
        attempts: int = 3,
    ) -> Any:
        return await self._request_json("POST", url, json=payload, headers=headers, attempts=attempts)

    async def _request_json(
        self,
        method: str,
        url: str,
        *,
        attempts: int,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> Any:
        last: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                async with self._semaphore:
                    async with self.session.request(method, url, headers=headers, **kwargs) as resp:
                        if resp.status in BLOCKED_STATUSES:
                            raise FetchError(f"{url} refused the client ({resp.status})", resp.status)
                        if resp.status == 429 or resp.status >= 500:
                            raise FetchError(f"{url} returned {resp.status}", resp.status)
                        if resp.status >= 400:
                            raise FetchError(f"{url} returned {resp.status}", resp.status)
                        return await resp.json(content_type=None)
            except FetchError as exc:
                last = exc
                if exc.blocked or exc.status == 404:
                    raise
            except (TimeoutError, aiohttp.ClientError) as exc:
                last = exc
            if attempt < attempts:
                await asyncio.sleep(min(2**attempt, 8))
        raise FetchError(f"{url} failed after {attempts} attempts: {last}")
