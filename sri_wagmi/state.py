"""Small sqlite store: what we already named, and which jobs are on.

Both matter across restarts -- repeating a call you made twenty minutes ago
is how a scanner becomes noise.
"""

from __future__ import annotations

import asyncio
import os
import sqlite3
import time
from contextlib import closing

SCHEMA = """
CREATE TABLE IF NOT EXISTS calls (
    mint TEXT NOT NULL,
    scan TEXT NOT NULL,
    called_at REAL NOT NULL,
    PRIMARY KEY (mint, scan)
);
CREATE TABLE IF NOT EXISTS job_state (
    name TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL,
    updated_at REAL NOT NULL
);
"""


class Store:
    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = asyncio.Lock()

    def _connect(self) -> sqlite3.Connection:
        directory = os.path.dirname(self._path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        conn = sqlite3.connect(self._path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sync(self) -> None:
        with closing(self._connect()) as conn:
            conn.executescript(SCHEMA)
            conn.commit()

    async def init(self) -> None:
        await asyncio.to_thread(self._init_sync)

    def _recent_sync(self, scan: str, since: float) -> set[str]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT mint FROM calls WHERE scan = ? AND called_at >= ?", (scan, since)
            ).fetchall()
        return {row["mint"] for row in rows}

    async def recently_called(self, scan: str, within_hours: float) -> set[str]:
        since = time.time() - within_hours * 3600
        async with self._lock:
            return await asyncio.to_thread(self._recent_sync, scan, since)

    def _record_sync(self, scan: str, mints: list[str]) -> None:
        now = time.time()
        with closing(self._connect()) as conn:
            conn.executemany(
                "INSERT INTO calls (mint, scan, called_at) VALUES (?, ?, ?) "
                "ON CONFLICT(mint, scan) DO UPDATE SET called_at = excluded.called_at",
                [(mint, scan, now) for mint in mints],
            )
            conn.commit()

    async def record_calls(self, scan: str, mints: list[str]) -> None:
        if not mints:
            return
        async with self._lock:
            await asyncio.to_thread(self._record_sync, scan, mints)

    def _get_job_sync(self, name: str) -> bool | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT enabled FROM job_state WHERE name = ?", (name,)).fetchone()
        return None if row is None else bool(row["enabled"])

    async def get_job_enabled(self, name: str) -> bool | None:
        async with self._lock:
            return await asyncio.to_thread(self._get_job_sync, name)

    def _set_job_sync(self, name: str, enabled: bool) -> None:
        with closing(self._connect()) as conn:
            conn.execute(
                "INSERT INTO job_state (name, enabled, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, "
                "updated_at = excluded.updated_at",
                (name, int(enabled), time.time()),
            )
            conn.commit()

    async def set_job_enabled(self, name: str, enabled: bool) -> None:
        async with self._lock:
            await asyncio.to_thread(self._set_job_sync, name, enabled)

    def _prune_sync(self, older_than: float) -> int:
        with closing(self._connect()) as conn:
            cur = conn.execute("DELETE FROM calls WHERE called_at < ?", (older_than,))
            conn.commit()
            return cur.rowcount

    async def prune(self, older_than_hours: float = 168.0) -> int:
        cutoff = time.time() - older_than_hours * 3600
        async with self._lock:
            return await asyncio.to_thread(self._prune_sync, cutoff)
