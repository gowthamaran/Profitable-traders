from __future__ import annotations

from sri_wagmi.sources.dexscreener import best_pair, parse_pair
from sri_wagmi.sources.pumpfun import CURVE_TOKEN_RESERVE, bonded_pct, to_token

PAIR = {
    "chainId": "solana",
    "dexId": "raydium",
    "pairAddress": "PAIR",
    "url": "https://dexscreener.com/solana/PAIR",
    "baseToken": {"address": "MINT", "symbol": "TEST", "name": "Test Coin"},
    "priceUsd": "0.00042",
    "liquidity": {"usd": 250000.5},
    "marketCap": 4200000,
    "fdv": 4300000,
    "volume": {"h1": 10000, "h6": 50000, "h24": 200000},
    "priceChange": {"h1": 3.2, "h6": -8.0, "h24": -40.5},
    "txns": {"h1": {"buys": 120, "sells": 60}, "h6": {"buys": 500, "sells": 400}},
    "pairCreatedAt": 1_700_000_000_000,
}


def test_parse_pair_maps_every_field_we_report():
    market = parse_pair(PAIR)
    assert market.price_usd == 0.00042
    assert market.liquidity_usd == 250000.5
    assert market.market_cap_usd == 4_200_000
    assert market.volume_h24 == 200_000
    assert market.price_change_h24 == -40.5
    assert (market.buys_h1, market.sells_h1) == (120, 60)
    assert market.pair_created_at_ms == 1_700_000_000_000


def test_parse_pair_survives_missing_sections():
    market = parse_pair({"baseToken": {"address": "MINT"}})
    assert market.liquidity_usd is None
    assert market.buys_h1 is None
    assert market.age_hours is None


def test_best_pair_prefers_the_matching_mint():
    other = dict(PAIR, baseToken={"address": "OTHER", "symbol": "X"}, liquidity={"usd": 9_000_000})
    assert best_pair([other, PAIR], "MINT")["baseToken"]["address"] == "MINT"


def test_best_pair_prefers_deeper_liquidity_within_a_dex():
    shallow = dict(PAIR, pairAddress="SHALLOW", liquidity={"usd": 1_000})
    deep = dict(PAIR, pairAddress="DEEP", liquidity={"usd": 900_000})
    assert best_pair([shallow, deep], "MINT")["pairAddress"] == "DEEP"


def test_best_pair_on_empty_input_is_none():
    assert best_pair([], "MINT") is None


def test_bonded_pct_half_curve():
    assert bonded_pct({"real_token_reserves": CURVE_TOKEN_RESERVE / 2}) == 50.0


def test_bonded_pct_complete_coin():
    assert bonded_pct({"complete": True, "real_token_reserves": 0}) == 100.0


def test_bonded_pct_scales_raw_base_units():
    coin = {"real_token_reserves": CURVE_TOKEN_RESERVE / 2 * 10**6, "decimals": 6}
    assert bonded_pct(coin) == 50.0


def test_bonded_pct_unknown_when_reserves_missing():
    """No reserves means no number. We do not estimate progress."""
    assert bonded_pct({"symbol": "X"}) is None


def test_to_token_reads_pumpfun_shape():
    token = to_token(
        {
            "mint": "MINT",
            "symbol": "PUMP",
            "name": "Pump Coin",
            "usd_market_cap": 55_000.0,
            "created_timestamp": 1_700_000_000_000,
            "real_token_reserves": CURVE_TOKEN_RESERVE * 0.6,
            "complete": False,
        }
    )
    assert token.mint == "MINT"
    assert token.symbol == "PUMP"
    assert token.pumpfun_market_cap_usd == 55_000.0
    assert token.bonded_pct == 40.0
    assert token.is_bonded is False
