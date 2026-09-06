"""End-to-end pipeline over a stubbed HTTP layer.

No network: the fake answers the same URLs the real sources call, so the test
exercises the actual source parsers, the actual filters and the actual budget
logic in Scanner.
"""

from __future__ import annotations

import time
from dataclasses import replace

import pytest

from sri_wagmi.config import Config
from sri_wagmi.scanner import Scanner
from sri_wagmi.sources.http import FetchError
from sri_wagmi.sources.pumpfun import CURVE_TOKEN_RESERVE

MINT_GOOD = "8x9c1v9BJmXsvKf2Xa1o8N2gT7pQwR3sMzYbEd4Hn5Ka"
MINT_MINTABLE = "5aB3cD4eF5gH6jK7mN8pQ9rS1tU2vW3xY4zA5bC6dE7f"
MINT_CLUSTERED = "3zY2xW1vU9tS8rQ7pN6mK5jH4gF3eD2cB1aZ9yX8wV7u"


def _pump_coin(mint: str, bonded: float, symbol: str) -> dict:
    return {
        "mint": mint,
        "symbol": symbol,
        "name": f"{symbol} Coin",
        "complete": False,
        "usd_market_cap": 60_000.0,
        "created_timestamp": int((time.time() - 3600) * 1000),
        "real_token_reserves": CURVE_TOKEN_RESERVE * (1 - bonded / 100),
    }


def _pair(mint: str, symbol: str, buys: int, sells: int) -> dict:
    return {
        "chainId": "solana",
        "dexId": "pumpfun",
        "pairAddress": f"PAIR_{symbol}",
        "url": f"https://dexscreener.com/solana/{mint}",
        "baseToken": {"address": mint, "symbol": symbol, "name": f"{symbol} Coin"},
        "priceUsd": "0.0001",
        "liquidity": {"usd": 90_000},
        "marketCap": 700_000,
        "volume": {"h1": 40_000, "h6": 120_000, "h24": 300_000},
        "priceChange": {"h1": 9.0, "h6": 20.0, "h24": 35.0},
        "txns": {"h1": {"buys": buys, "sells": sells}},
        "pairCreatedAt": int((time.time() - 3600) * 1000),
    }


class FakeHttp:
    """Answers the endpoints our sources actually call, and records the calls."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.mint_authority_for: set[str] = {MINT_MINTABLE}
        self.top_holder_pct: dict[str, float] = {MINT_CLUSTERED: 70.0}
        self.fail_pumpfun = False

    async def get_json(self, url, *, params=None, headers=None, attempts=3):
        self.calls.append(url)
        if "/coins" in url:
            if self.fail_pumpfun:
                raise FetchError("pump.fun returned 503", 503)
            return [
                _pump_coin(MINT_GOOD, 45.0, "GOOD"),
                _pump_coin(MINT_MINTABLE, 50.0, "MINTABLE"),
                _pump_coin(MINT_CLUSTERED, 55.0, "CLUSTER"),
                _pump_coin("EarlyMint1111111111111111111111111111111111", 8.0, "EARLY"),
                _pump_coin("LateMint111111111111111111111111111111111111", 95.0, "LATE"),
            ]
        if "/latest/dex/tokens/" in url:
            requested = url.rsplit("/", 1)[-1].split(",")
            pairs = []
            for mint in requested:
                symbol = {
                    MINT_GOOD: "GOOD",
                    MINT_MINTABLE: "MINTABLE",
                    MINT_CLUSTERED: "CLUSTER",
                }.get(mint)
                if symbol:
                    pairs.append(_pair(mint, symbol, buys=200, sells=80))
            return {"pairs": pairs}
        if "/latest/dex/search" in url:
            return {"pairs": [_pair(MINT_GOOD, "GOOD", 200, 80)]}
        raise AssertionError(f"unexpected GET {url}")

    async def post_json(self, url, *, payload, headers=None, attempts=3):
        method = payload["method"]
        self.calls.append(f"rpc:{method}")
        if method == "getAccountInfo":
            mint = payload["params"][0]
            return {
                "result": {
                    "value": {
                        "data": {
                            "parsed": {
                                "info": {
                                    "decimals": 6,
                                    "supply": "1000000000000000",
                                    "mintAuthority": "AUTH" if mint in self.mint_authority_for else None,
                                    "freezeAuthority": None,
                                }
                            }
                        }
                    }
                }
            }
        if method == "getTokenLargestAccounts":
            mint = payload["params"][0]
            pct = self.top_holder_pct.get(mint, 10.0)
            share = pct / 100 / 10  # spread over ten accounts
            return {
                "result": {
                    "value": [{"address": f"ACC{i}", "uiAmount": 1_000_000_000 * share} for i in range(10)]
                }
            }
        if method == "getTokenSupply":
            return {"result": {"value": {"uiAmount": 1_000_000_000}}}
        if method == "getMultipleAccounts":
            addresses = payload["params"][0]
            return {
                "result": {
                    "value": [{"data": {"parsed": {"info": {"owner": f"OWNER_{a}"}}}} for a in addresses]
                }
            }
        raise AssertionError(f"unexpected RPC {method}")


@pytest.fixture
def scanner(monkeypatch) -> Scanner:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x")
    monkeypatch.setenv("ALLOWED_CHAT_IDS", "1")
    return Scanner(Config(), FakeHttp())


@pytest.mark.asyncio
async def test_trench_scan_names_only_the_clean_coin(scanner):
    result = await scanner.trench_scan()
    named = {v.token.mint for v in result.passes}
    assert named == {MINT_GOOD}
    assert result.screened == 5


@pytest.mark.asyncio
async def test_trench_scan_records_why_the_rest_failed(scanner):
    result = await scanner.trench_scan()
    reasons = {v.token.symbol: v.reasons for v in result.rejections}
    assert any("mint authority live" in r for r in reasons["MINTABLE"])
    assert any("clustered" in r for r in reasons["CLUSTER"])


@pytest.mark.asyncio
async def test_coins_outside_the_bonding_band_never_reach_the_chain_reads(scanner):
    """The band is a free filter, so it runs before we pay for RPC."""
    await scanner.trench_scan()
    rpc_reads = [c for c in scanner.http.calls if c == "rpc:getAccountInfo"]
    assert len(rpc_reads) == 3  # EARLY at 8% and LATE at 95% were dropped first


@pytest.mark.asyncio
async def test_already_called_mints_are_excluded(scanner):
    result = await scanner.trench_scan(exclude={MINT_GOOD})
    assert MINT_GOOD not in {v.token.mint for v in result.passes}


@pytest.mark.asyncio
async def test_report_is_capped_at_the_configured_number_of_names(scanner):
    scanner.config = replace(scanner.config, max_calls_per_report=1)
    scanner.http.mint_authority_for = set()
    scanner.http.top_holder_pct = {}
    result = await scanner.trench_scan()
    assert len(result.passes) == 1


@pytest.mark.asyncio
async def test_dead_upstream_reports_instead_of_raising(scanner):
    scanner.http.fail_pumpfun = True
    result = await scanner.trench_scan()
    assert result.passes == []
    assert "pump.fun feed unavailable" in result.note


@pytest.mark.asyncio
async def test_check_by_contract_reads_chain_and_market(scanner):
    token, note = await scanner.check(MINT_GOOD)
    assert token is not None
    assert token.mint == MINT_GOOD
    assert token.authorities.checked
    assert token.authorities.mint_revoked is True
    assert token.market.liquidity_usd == 90_000
    assert "CT flood check skipped" in note


@pytest.mark.asyncio
async def test_check_by_name_resolves_through_dexscreener(scanner):
    token, _ = await scanner.check("$GOOD")
    assert token is not None
    assert token.mint == MINT_GOOD


@pytest.mark.asyncio
async def test_check_with_no_input_asks_for_one(scanner):
    token, note = await scanner.check("   ")
    assert token is None
    assert "contract" in note


@pytest.mark.asyncio
async def test_culture_scan_is_off_without_credentials(scanner):
    hits, matches, note = await scanner.culture_scan()
    assert hits == []
    assert "no X API credentials" in note
