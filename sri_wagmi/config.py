"""Runtime configuration, entirely environment driven.

Nothing here reaches the network. Every threshold the scanners use lives in
this module so the filters stay auditable in one place.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_str(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    raw = _env_str(key)
    return int(raw) if raw else default


def _env_float(key: str, default: float) -> float:
    raw = _env_str(key)
    return float(raw) if raw else default


def _env_bool(key: str, default: bool) -> bool:
    raw = _env_str(key).lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_id_list(key: str) -> tuple[int, ...]:
    raw = _env_str(key)
    if not raw:
        return ()
    return tuple(int(part) for part in raw.replace(",", " ").split())


@dataclass(frozen=True)
class TrenchFilter:
    """The 10-minute pump.fun trench pass."""

    bonded_min_pct: float = field(default_factory=lambda: _env_float("TRENCH_BONDED_MIN_PCT", 30.0))
    bonded_max_pct: float = field(default_factory=lambda: _env_float("TRENCH_BONDED_MAX_PCT", 70.0))
    require_mint_revoked: bool = field(default_factory=lambda: _env_bool("TRENCH_REQUIRE_MINT_REVOKED", True))
    require_freeze_revoked: bool = field(
        default_factory=lambda: _env_bool("TRENCH_REQUIRE_FREEZE_REVOKED", True)
    )
    # Share of circulating supply held by the top N non-pool accounts above
    # which the holder base is called clustered.
    max_top_holder_pct: float = field(default_factory=lambda: _env_float("TRENCH_MAX_TOP_HOLDER_PCT", 25.0))
    top_holder_depth: int = field(default_factory=lambda: _env_int("TRENCH_TOP_HOLDER_DEPTH", 10))
    # "buys up": buy count must beat sell count by this ratio over the window.
    min_buy_sell_ratio: float = field(default_factory=lambda: _env_float("TRENCH_MIN_BUY_SELL_RATIO", 1.3))
    min_txns: int = field(default_factory=lambda: _env_int("TRENCH_MIN_TXNS", 30))
    max_age_hours: float = field(default_factory=lambda: _env_float("TRENCH_MAX_AGE_HOURS", 48.0))


@dataclass(frozen=True)
class SecondaryFilter:
    """The survivors pass: older coins that already took their beating."""

    min_age_days: float = field(default_factory=lambda: _env_float("SECONDARY_MIN_AGE_DAYS", 7.0))
    min_market_cap_usd: float = field(
        default_factory=lambda: _env_float("SECONDARY_MIN_MCAP_USD", 2_000_000.0)
    )
    max_market_cap_usd: float = field(
        default_factory=lambda: _env_float("SECONDARY_MAX_MCAP_USD", 25_000_000.0)
    )
    # LP "not thin": liquidity must be at least this share of market cap.
    min_liquidity_ratio: float = field(default_factory=lambda: _env_float("SECONDARY_MIN_LP_RATIO", 0.03))
    min_liquidity_usd: float = field(default_factory=lambda: _env_float("SECONDARY_MIN_LP_USD", 80_000.0))
    # Volume coming back: last 6h pace must beat the trailing 24h pace.
    min_volume_recovery: float = field(default_factory=lambda: _env_float("SECONDARY_MIN_VOL_RECOVERY", 1.2))
    # It has to actually have dumped to count as a recovery.
    max_drawdown_pct: float = field(default_factory=lambda: _env_float("SECONDARY_MAX_DRAWDOWN_PCT", -15.0))


@dataclass(frozen=True)
class Config:
    telegram_token: str = field(default_factory=lambda: _env_str("TELEGRAM_BOT_TOKEN"))
    # Chats allowed to command the bot. Empty means the bot answers nobody
    # until you set it, which is the safe default for a token in a repo.
    allowed_chat_ids: tuple[int, ...] = field(default_factory=lambda: _env_id_list("ALLOWED_CHAT_IDS"))
    # Where unattended scan output lands.
    broadcast_chat_id: int | None = field(
        default_factory=lambda: (_env_id_list("BROADCAST_CHAT_ID") or (None,))[0]
    )

    solana_rpc_url: str = field(
        default_factory=lambda: _env_str("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    )
    dexscreener_base: str = field(
        default_factory=lambda: _env_str("DEXSCREENER_BASE", "https://api.dexscreener.com")
    )
    pumpfun_base: str = field(
        default_factory=lambda: _env_str("PUMPFUN_BASE", "https://frontend-api-v3.pump.fun")
    )
    twitter_bearer_token: str = field(default_factory=lambda: _env_str("TWITTER_BEARER_TOKEN"))

    trench_interval_seconds: int = field(default_factory=lambda: _env_int("TRENCH_INTERVAL_SECONDS", 600))
    secondary_interval_seconds: int = field(
        default_factory=lambda: _env_int("SECONDARY_INTERVAL_SECONDS", 1800)
    )
    culture_interval_seconds: int = field(default_factory=lambda: _env_int("CULTURE_INTERVAL_SECONDS", 7200))

    # Per the brief: the trench scan runs, the culture scan does not until
    # someone turns it on.
    trench_enabled: bool = field(default_factory=lambda: _env_bool("TRENCH_ENABLED", True))
    secondary_enabled: bool = field(default_factory=lambda: _env_bool("SECONDARY_ENABLED", True))
    culture_enabled: bool = field(default_factory=lambda: _env_bool("CULTURE_ENABLED", False))

    # Max names per report. Beyond this it is noise, so we stay quiet instead.
    max_calls_per_report: int = field(default_factory=lambda: _env_int("MAX_CALLS_PER_REPORT", 3))
    # Don't repeat a name inside this window.
    repeat_suppression_hours: float = field(
        default_factory=lambda: _env_float("REPEAT_SUPPRESSION_HOURS", 24.0)
    )
    # A ticker with more than this many recent CT posts is already flooded.
    ct_flood_threshold: int = field(default_factory=lambda: _env_int("CT_FLOOD_THRESHOLD", 25))

    candidate_pool_size: int = field(default_factory=lambda: _env_int("CANDIDATE_POOL_SIZE", 60))
    http_timeout_seconds: float = field(default_factory=lambda: _env_float("HTTP_TIMEOUT_SECONDS", 15.0))
    http_max_concurrency: int = field(default_factory=lambda: _env_int("HTTP_MAX_CONCURRENCY", 8))
    state_path: str = field(default_factory=lambda: _env_str("STATE_PATH", "state/sri_wagmi.sqlite3"))
    log_level: str = field(default_factory=lambda: _env_str("LOG_LEVEL", "INFO"))

    trench: TrenchFilter = field(default_factory=TrenchFilter)
    secondary: SecondaryFilter = field(default_factory=SecondaryFilter)

    def validate(self) -> None:
        if not self.telegram_token:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")
        if not self.allowed_chat_ids:
            raise RuntimeError(
                "ALLOWED_CHAT_IDS is not set; refusing to start an open bot. Set it to your own chat id."
            )


def load_config() -> Config:
    return Config()
