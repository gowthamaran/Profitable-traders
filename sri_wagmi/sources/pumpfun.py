"""pump.fun frontend API: the trench feed and bonding-curve progress.

Bonding progress is computed from the curve reserves the API returns rather
than guessed from market cap, and if the fields are missing we return None
instead of a number that looks real.
"""

from __future__ import annotations

import logging
from typing import Any

from ..models import Token
from .http import FetchError, HttpClient

log = logging.getLogger(__name__)

# Tokens sitting on the curve at launch. The curve is complete once these are
# sold through, so progress is how much of this reserve has gone.
CURVE_TOKEN_RESERVE = 793_100_000.0


def _f(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def bonded_pct(coin: dict[str, Any]) -> float | None:
    """Percent of the bonding curve consumed, or None if unknowable."""
    if coin.get("complete") is True:
        return 100.0
    reserves = _f(coin.get("real_token_reserves"))
    if reserves is None:
        return None
    decimals = _f(coin.get("decimals"))
    if decimals is not None and reserves > CURVE_TOKEN_RESERVE * 10:
        # Some responses report raw base units; scale them down.
        reserves = reserves / (10 ** int(decimals))
    progress = 100.0 * (1.0 - (reserves / CURVE_TOKEN_RESERVE))
    return max(0.0, min(100.0, progress))


def to_token(coin: dict[str, Any]) -> Token:
    mint = str(coin.get("mint") or coin.get("address") or "")
    return Token(
        mint=mint,
        symbol=str(coin.get("symbol") or ""),
        name=str(coin.get("name") or ""),
        source="pump.fun",
        bonded_pct=bonded_pct(coin),
        is_bonded=bool(coin.get("complete")),
        created_at_ms=int(_f(coin.get("created_timestamp")) or 0) or None,
        pumpfun_market_cap_usd=_f(coin.get("usd_market_cap")),
        raw=coin,
    )


class PumpFun:
    def __init__(self, http: HttpClient, base: str = "https://frontend-api-v3.pump.fun") -> None:
        self._http = http
        self._base = base.rstrip("/")

    async def recent_coins(self, limit: int = 60, sort: str = "created_timestamp") -> list[Token]:
        """Newest coins on the curve, newest first."""
        params = {
            "offset": 0,
            "limit": max(1, min(limit, 100)),
            "sort": sort,
            "order": "DESC",
            "includeNsfw": "false",
        }
        data = await self._http.get_json(f"{self._base}/coins", params=params)
        coins = data if isinstance(data, list) else (data or {}).get("coins") or []
        tokens = [to_token(c) for c in coins if isinstance(c, dict)]
        return [t for t in tokens if t.mint]

    async def coin(self, mint: str) -> Token | None:
        try:
            data = await self._http.get_json(f"{self._base}/coins/{mint}")
        except FetchError as exc:
            log.info("pump.fun lookup failed for %s: %s", mint, exc)
            return None
        if not isinstance(data, dict) or not data.get("mint"):
            return None
        return to_token(data)
