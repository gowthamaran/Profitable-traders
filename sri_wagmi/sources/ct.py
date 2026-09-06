"""Crypto Twitter reads, used for two questions.

1. "Has CT already flooded this ticker?" -- a recent mention count.
2. The culture scan: what is spreading on X *outside* CT.

Both need an X API bearer token. Without one we return None and the report
says the check did not run. We never estimate a mention count.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from .http import FetchError, HttpClient

log = logging.getLogger(__name__)

API_BASE = "https://api.twitter.com/2"

# Accounts and words that mark a post as already-inside crypto twitter. The
# culture scan subtracts these; the flood check counts them.
CT_MARKERS = (
    "solana",
    "pumpfun",
    "pump.fun",
    "memecoin",
    "meme coin",
    "degen",
    "ape",
    "100x",
    "dexscreener",
    "bonk",
    "rugged",
    "trenches",
    "$sol",
    "ct",
)

_TICKER_RE = re.compile(r"\$([A-Za-z][A-Za-z0-9]{1,9})\b")


@dataclass(slots=True)
class CultureHit:
    """A phrase spreading outside CT, with the evidence behind it."""

    phrase: str
    mentions: int
    sample_text: str = ""
    sample_url: str = ""


class CtClient:
    def __init__(self, http: HttpClient, bearer_token: str = "") -> None:
        self._http = http
        self._token = bearer_token

    @property
    def available(self) -> bool:
        return bool(self._token)

    @property
    def unavailable_reason(self) -> str:
        return "no X API credentials configured (TWITTER_BEARER_TOKEN)"

    async def _search(self, query: str, max_results: int = 100) -> list[dict[str, Any]]:
        if not self.available:
            raise FetchError(self.unavailable_reason)
        params = {
            "query": query,
            "max_results": max(10, min(max_results, 100)),
            "tweet.fields": "public_metrics,created_at,lang",
        }
        data = await self._http.get_json(
            f"{API_BASE}/tweets/search/recent",
            params=params,
            headers={"Authorization": f"Bearer {self._token}"},
        )
        return list((data or {}).get("data") or [])

    async def mention_count(self, ticker: str, mint: str | None = None) -> int | None:
        """How loud CT already is about this name. None means we could not look."""
        if not self.available:
            return None
        term = ticker.strip().lstrip("$")
        if not term and not mint:
            return None
        clauses = []
        if term:
            clauses.append(f"${term}")
        if mint:
            clauses.append(f'"{mint}"')
        query = f"({' OR '.join(clauses)}) -is:retweet"
        try:
            tweets = await self._search(query)
        except FetchError as exc:
            log.info("CT mention check failed for %s: %s", ticker or mint, exc)
            return None
        return len(tweets)

    async def culture_candidates(self, queries: list[str], limit: int = 8) -> list[CultureHit]:
        """Phrases and tickers spreading on X, weighted away from CT itself."""
        if not self.available:
            raise FetchError(self.unavailable_reason)
        counts: dict[str, CultureHit] = {}
        for query in queries:
            try:
                tweets = await self._search(f"{query} -is:retweet lang:en")
            except FetchError as exc:
                log.info("culture query failed (%s): %s", query, exc)
                continue
            for tweet in tweets:
                text = str(tweet.get("text") or "")
                if _is_ct_native(text):
                    continue
                for phrase in _phrases(text):
                    hit = counts.get(phrase)
                    if hit is None:
                        counts[phrase] = CultureHit(
                            phrase=phrase,
                            mentions=1,
                            sample_text=text[:180],
                            sample_url=f"https://x.com/i/status/{tweet.get('id')}",
                        )
                    else:
                        hit.mentions += 1
        ranked = sorted(counts.values(), key=lambda h: h.mentions, reverse=True)
        return [hit for hit in ranked if hit.mentions > 1][:limit]


def _is_ct_native(text: str) -> bool:
    lowered = text.lower()
    return sum(marker in lowered for marker in CT_MARKERS) >= 2


def _phrases(text: str) -> list[str]:
    """Cashtags first; they are what a coin would be named after."""
    return [match.group(1).upper() for match in _TICKER_RE.finditer(text)]
