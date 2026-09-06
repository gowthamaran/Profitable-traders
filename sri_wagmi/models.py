"""Normalised shapes shared by the sources, the filters and the formatter."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


def _now_ms() -> int:
    return int(time.time() * 1000)


@dataclass(slots=True)
class MintAuthorities:
    """What the SPL mint account says about who still controls the token."""

    mint_authority: str | None = None
    freeze_authority: str | None = None
    supply: float | None = None
    decimals: int | None = None
    checked: bool = False

    @property
    def mint_revoked(self) -> bool | None:
        return None if not self.checked else self.mint_authority is None

    @property
    def freeze_revoked(self) -> bool | None:
        return None if not self.checked else self.freeze_authority is None


@dataclass(slots=True)
class HolderSpread:
    """Concentration read from the largest token accounts."""

    top_holder_pct: float | None = None
    depth: int = 0
    checked: bool = False
    note: str = ""

    def is_clustered(self, max_top_holder_pct: float) -> bool | None:
        """True when the top accounts hold more than the allowed share.

        None when we could not read the holder table at all -- an unknown is
        never silently treated as a pass.
        """
        if not self.checked or self.top_holder_pct is None:
            return None
        return self.top_holder_pct > max_top_holder_pct


@dataclass(slots=True)
class Market:
    """A Dexscreener pair, flattened to the numbers we actually use."""

    pair_address: str | None = None
    dex_id: str | None = None
    url: str | None = None
    price_usd: float | None = None
    liquidity_usd: float | None = None
    market_cap_usd: float | None = None
    fdv_usd: float | None = None
    volume_h1: float | None = None
    volume_h6: float | None = None
    volume_h24: float | None = None
    price_change_h1: float | None = None
    price_change_h6: float | None = None
    price_change_h24: float | None = None
    buys_h1: int | None = None
    sells_h1: int | None = None
    buys_h6: int | None = None
    sells_h6: int | None = None
    pair_created_at_ms: int | None = None

    @property
    def age_hours(self) -> float | None:
        if not self.pair_created_at_ms:
            return None
        return max(0.0, (_now_ms() - self.pair_created_at_ms) / 3_600_000)

    @property
    def age_days(self) -> float | None:
        hours = self.age_hours
        return None if hours is None else hours / 24


@dataclass(slots=True)
class Token:
    """One coin, as much as we could actually confirm about it."""

    mint: str
    symbol: str = ""
    name: str = ""
    source: str = "unknown"
    bonded_pct: float | None = None
    is_bonded: bool = False
    created_at_ms: int | None = None
    pumpfun_market_cap_usd: float | None = None
    market: Market = field(default_factory=Market)
    authorities: MintAuthorities = field(default_factory=MintAuthorities)
    holders: HolderSpread = field(default_factory=HolderSpread)
    ct_mentions: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def label(self) -> str:
        if self.symbol and self.name and self.symbol.lower() != self.name.lower():
            return f"${self.symbol} ({self.name})"
        return f"${self.symbol}" if self.symbol else (self.name or self.mint[:8])

    @property
    def market_cap_usd(self) -> float | None:
        return self.market.market_cap_usd or self.market.fdv_usd or self.pumpfun_market_cap_usd

    @property
    def age_hours(self) -> float | None:
        if self.market.age_hours is not None:
            return self.market.age_hours
        if self.created_at_ms:
            return max(0.0, (_now_ms() - self.created_at_ms) / 3_600_000)
        return None

    @property
    def pump_url(self) -> str:
        return f"https://pump.fun/coin/{self.mint}"

    @property
    def dexscreener_url(self) -> str:
        return self.market.url or f"https://dexscreener.com/solana/{self.mint}"

    @property
    def ct_flooded(self) -> bool | None:
        return None if self.ct_mentions is None else self.ct_mentions > 0


@dataclass(slots=True)
class Verdict:
    """Why a candidate passed or, more often, did not."""

    token: Token
    passed: bool
    reasons: list[str] = field(default_factory=list)
    score: float = 0.0
    unknowns: list[str] = field(default_factory=list)

    def fail(self, reason: str) -> Verdict:
        self.passed = False
        self.reasons.append(reason)
        return self
