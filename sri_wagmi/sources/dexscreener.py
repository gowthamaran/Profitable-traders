"""Dexscreener: prices, liquidity, volume, txn counts, pair age.

This is the one source that answers most of the ticker questions, so the
mapping from their payload to our Market lives here and nowhere else.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from ..models import Market, Token
from .http import FetchError, HttpClient

log = logging.getLogger(__name__)

# Pairs we would rather quote when a token trades in several places.
PREFERRED_DEXES = ("raydium", "meteora", "orca", "pumpswap", "pumpfun")


def _f(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _i(value: Any) -> int | None:
    f = _f(value)
    return None if f is None else int(f)


def _pair_score(pair: dict[str, Any]) -> tuple[int, float]:
    """Rank pairs: known dex first, then deepest liquidity."""
    dex = str(pair.get("dexId", "")).lower()
    rank = PREFERRED_DEXES.index(dex) if dex in PREFERRED_DEXES else len(PREFERRED_DEXES)
    liquidity = _f((pair.get("liquidity") or {}).get("usd")) or 0.0
    return (rank, -liquidity)


def parse_pair(pair: dict[str, Any]) -> Market:
    liquidity = pair.get("liquidity") or {}
    volume = pair.get("volume") or {}
    change = pair.get("priceChange") or {}
    txns = pair.get("txns") or {}
    h1 = txns.get("h1") or {}
    h6 = txns.get("h6") or {}
    return Market(
        pair_address=pair.get("pairAddress"),
        dex_id=pair.get("dexId"),
        url=pair.get("url"),
        price_usd=_f(pair.get("priceUsd")),
        liquidity_usd=_f(liquidity.get("usd")),
        market_cap_usd=_f(pair.get("marketCap")),
        fdv_usd=_f(pair.get("fdv")),
        volume_h1=_f(volume.get("h1")),
        volume_h6=_f(volume.get("h6")),
        volume_h24=_f(volume.get("h24")),
        price_change_h1=_f(change.get("h1")),
        price_change_h6=_f(change.get("h6")),
        price_change_h24=_f(change.get("h24")),
        buys_h1=_i(h1.get("buys")),
        sells_h1=_i(h1.get("sells")),
        buys_h6=_i(h6.get("buys")),
        sells_h6=_i(h6.get("sells")),
        pair_created_at_ms=_i(pair.get("pairCreatedAt")),
    )


def best_pair(pairs: Iterable[dict[str, Any]], mint: str | None = None) -> dict[str, Any] | None:
    candidates = [p for p in pairs if isinstance(p, dict)]
    if mint:
        matching = [
            p
            for p in candidates
            if str((p.get("baseToken") or {}).get("address", "")).lower() == mint.lower()
        ]
        candidates = matching or candidates
    if not candidates:
        return None
    return sorted(candidates, key=_pair_score)[0]


class Dexscreener:
    def __init__(self, http: HttpClient, base: str = "https://api.dexscreener.com") -> None:
        self._http = http
        self._base = base.rstrip("/")

    async def pairs_for_token(self, mint: str) -> list[dict[str, Any]]:
        data = await self._http.get_json(f"{self._base}/latest/dex/tokens/{mint}")
        pairs = (data or {}).get("pairs") or []
        return [p for p in pairs if isinstance(p, dict)]

    async def pairs_for_tokens(self, mints: list[str]) -> dict[str, list[dict[str, Any]]]:
        """Batch lookup. Dexscreener takes up to 30 addresses per call."""
        out: dict[str, list[dict[str, Any]]] = {m: [] for m in mints}
        for start in range(0, len(mints), 30):
            chunk = mints[start : start + 30]
            try:
                data = await self._http.get_json(f"{self._base}/latest/dex/tokens/{','.join(chunk)}")
            except FetchError as exc:
                log.warning("dexscreener batch failed: %s", exc)
                continue
            for pair in (data or {}).get("pairs") or []:
                address = str((pair.get("baseToken") or {}).get("address", ""))
                for mint in chunk:
                    if address.lower() == mint.lower():
                        out[mint].append(pair)
        return out

    async def search(self, query: str) -> list[dict[str, Any]]:
        data = await self._http.get_json(f"{self._base}/latest/dex/search", params={"q": query})
        pairs = (data or {}).get("pairs") or []
        return [p for p in pairs if isinstance(p, dict)]

    async def enrich(self, token: Token) -> Token:
        """Attach live market data to a token we already have a mint for."""
        try:
            pairs = await self.pairs_for_token(token.mint)
        except FetchError as exc:
            log.info("dexscreener enrich failed for %s: %s", token.mint, exc)
            return token
        pair = best_pair(pairs, token.mint)
        if pair is None:
            return token
        token.market = parse_pair(pair)
        base = pair.get("baseToken") or {}
        token.symbol = token.symbol or str(base.get("symbol") or "")
        token.name = token.name or str(base.get("name") or "")
        return token

    def apply_pairs(self, token: Token, pairs: list[dict[str, Any]]) -> Token:
        pair = best_pair(pairs, token.mint)
        if pair is None:
            return token
        token.market = parse_pair(pair)
        base = pair.get("baseToken") or {}
        token.symbol = token.symbol or str(base.get("symbol") or "")
        token.name = token.name or str(base.get("name") or "")
        return token
