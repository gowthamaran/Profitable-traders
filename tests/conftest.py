from __future__ import annotations

import time

import pytest

from sri_wagmi.models import HolderSpread, Market, MintAuthorities, Token


def ms_ago(hours: float) -> int:
    return int((time.time() - hours * 3600) * 1000)


@pytest.fixture
def clean_token() -> Token:
    """A coin that passes the trench filter, so tests can break one thing."""
    token = Token(
        mint="So11111111111111111111111111111111111111112",
        symbol="CLEAN",
        name="Clean Coin",
        source="pump.fun",
        bonded_pct=48.0,
        created_at_ms=ms_ago(3),
    )
    token.market = Market(
        pair_address="pair1",
        dex_id="raydium",
        liquidity_usd=120_000.0,
        market_cap_usd=800_000.0,
        volume_h1=45_000.0,
        volume_h6=180_000.0,
        volume_h24=500_000.0,
        price_change_h1=12.0,
        price_change_h6=30.0,
        price_change_h24=45.0,
        buys_h1=180,
        sells_h1=90,
        buys_h6=600,
        sells_h6=400,
        pair_created_at_ms=ms_ago(3),
    )
    token.authorities = MintAuthorities(
        mint_authority=None, freeze_authority=None, supply=1e9, decimals=6, checked=True
    )
    token.holders = HolderSpread(top_holder_pct=14.0, depth=10, checked=True)
    return token


@pytest.fixture
def survivor_token() -> Token:
    """A coin that passes the secondary filter."""
    token = Token(mint="Surv1v0r", symbol="SURV", name="Survivor", source="dexscreener")
    token.market = Market(
        pair_address="pair2",
        dex_id="raydium",
        liquidity_usd=600_000.0,
        market_cap_usd=8_000_000.0,
        volume_h1=90_000.0,
        volume_h6=600_000.0,
        volume_h24=1_200_000.0,
        price_change_h6=6.0,
        price_change_h24=-30.0,
        buys_h6=2_000,
        sells_h6=1_500,
        pair_created_at_ms=ms_ago(24 * 30),
    )
    token.authorities = MintAuthorities(
        mint_authority=None, freeze_authority=None, supply=1e9, decimals=6, checked=True
    )
    token.holders = HolderSpread(top_holder_pct=12.0, depth=10, checked=True)
    return token
