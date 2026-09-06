"""The engine: pull candidates, confirm them on chain, apply the filters.

Order matters for cost. Cheap batch calls first (Dexscreener), then the
per-token RPC reads, and only for the handful that survived the cheap cuts.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from .analysis.filters import evaluate_secondary, evaluate_trench
from .config import Config
from .models import Token, Verdict
from .resolve import Query, parse_query
from .sources.ct import CtClient, CultureHit
from .sources.dexscreener import Dexscreener, best_pair, parse_pair
from .sources.http import FetchError, HttpClient
from .sources.pumpfun import PumpFun
from .sources.solana import SolanaRpc

log = logging.getLogger(__name__)

# Seed queries for the culture pass: mainstream-ish surfaces, not CT.
CULTURE_QUERIES = (
    '(trending OR viral OR "everyone is") -crypto -memecoin',
    '"can\'t stop" OR "obsessed with" -crypto -token',
    "context:66.961961812492148736",  # X's own "Entertainment" domain
)

# How many survivors we pay RPC for.
CHAIN_CHECK_BUDGET = 12


@dataclass(slots=True)
class ScanResult:
    scan: str
    passes: list[Verdict] = field(default_factory=list)
    rejections: list[Verdict] = field(default_factory=list)
    screened: int = 0
    note: str = ""


class Scanner:
    def __init__(self, config: Config, http: HttpClient) -> None:
        self.config = config
        self.http = http
        self.dex = Dexscreener(http, config.dexscreener_base)
        self.pump = PumpFun(http, config.pumpfun_base)
        self.rpc = SolanaRpc(http, config.solana_rpc_url)
        self.ct = CtClient(http, config.twitter_bearer_token)

    # ---------------------------------------------------------------- chain

    async def confirm_on_chain(self, token: Token) -> Token:
        """The two reads no indexer gets to answer for us."""
        authorities, holders = await asyncio.gather(
            self.rpc.mint_authorities(token.mint),
            self.rpc.holder_spread(token.mint, self.config.trench.top_holder_depth),
            return_exceptions=True,
        )
        if not isinstance(authorities, Exception):
            token.authorities = authorities
        if not isinstance(holders, Exception):
            token.holders = holders
        return token

    async def add_ct_context(self, token: Token) -> Token:
        if not self.ct.available:
            return token
        token.ct_mentions = await self.ct.mention_count(token.symbol, token.mint)
        return token

    # --------------------------------------------------------------- trench

    async def trench_scan(self, *, exclude: set[str] | None = None) -> ScanResult:
        """10-minute pass: 30-70% bonded, mint+freeze dead, clean spread, buys up."""
        result = ScanResult(scan="trench")
        exclude = exclude or set()
        try:
            candidates = await self.pump.recent_coins(self.config.candidate_pool_size)
        except FetchError as exc:
            result.note = f"pump.fun feed unavailable: {exc}"
            return result

        rules = self.config.trench
        # Cheap cut first: bonding band and the repeat filter, no network.
        shortlist = [
            t
            for t in candidates
            if t.mint not in exclude
            and t.bonded_pct is not None
            and rules.bonded_min_pct <= t.bonded_pct <= rules.bonded_max_pct
        ]
        result.screened = len(candidates)
        if not shortlist:
            result.note = (
                f"{len(candidates)} on the feed, none in the "
                f"{rules.bonded_min_pct:.0f}-{rules.bonded_max_pct:.0f}% band."
            )
            return result

        pairs = await self.dex.pairs_for_tokens([t.mint for t in shortlist])
        for token in shortlist:
            self.dex.apply_pairs(token, pairs.get(token.mint, []))

        # Only pay for chain reads on the ones with live flow.
        shortlist.sort(key=lambda t: t.market.volume_h1 or 0.0, reverse=True)
        checked = shortlist[:CHAIN_CHECK_BUDGET]
        await asyncio.gather(*(self.confirm_on_chain(t) for t in checked))

        verdicts = [evaluate_trench(t, rules) for t in checked]
        await self._finalise(result, verdicts)
        return result

    # ------------------------------------------------------------ secondary

    async def secondary_scan(self, *, exclude: set[str] | None = None) -> ScanResult:
        """Survivors pass: 7d+, $2m-$25m, LP not thin, volume back after the dump."""
        result = ScanResult(scan="secondary")
        exclude = exclude or set()
        rules = self.config.secondary

        candidates = await self._secondary_universe()
        result.screened = len(candidates)
        if not candidates:
            result.note = "Dexscreener returned nothing usable for the survivors pass."
            return result

        shortlist = []
        for token in candidates:
            if token.mint in exclude:
                continue
            mcap = token.market_cap_usd
            if mcap is None or not (rules.min_market_cap_usd <= mcap <= rules.max_market_cap_usd):
                continue
            days = token.market.age_days
            if days is None or days < rules.min_age_days:
                continue
            shortlist.append(token)

        if not shortlist:
            result.note = (
                f"{len(candidates)} pairs seen, none inside "
                f"${rules.min_market_cap_usd / 1e6:,.0f}m-${rules.max_market_cap_usd / 1e6:,.0f}m at "
                f"{rules.min_age_days:,.0f}d+."
            )
            return result

        shortlist.sort(key=lambda t: t.market.volume_h6 or 0.0, reverse=True)
        checked = shortlist[:CHAIN_CHECK_BUDGET]
        await asyncio.gather(*(self.confirm_on_chain(t) for t in checked))

        verdicts = [evaluate_secondary(t, rules) for t in checked]
        await self._finalise(result, verdicts)
        return result

    async def _secondary_universe(self) -> list[Token]:
        """Solana pairs with real turnover, deduped by mint."""
        seen: dict[str, Token] = {}
        queries = ("solana", "sol pump", "wif", "bonk")
        for query in queries:
            try:
                pairs = await self.dex.search(query)
            except FetchError as exc:
                log.info("secondary universe query %r failed: %s", query, exc)
                continue
            for pair in pairs:
                if str(pair.get("chainId")) != "solana":
                    continue
                base = pair.get("baseToken") or {}
                mint = str(base.get("address") or "")
                if not mint or mint in seen:
                    continue
                token = Token(
                    mint=mint,
                    symbol=str(base.get("symbol") or ""),
                    name=str(base.get("name") or ""),
                    source="dexscreener",
                    is_bonded=True,
                )
                token.market = parse_pair(pair)
                seen[mint] = token
        return list(seen.values())

    # ---------------------------------------------------------------- shared

    async def _finalise(self, result: ScanResult, verdicts: list[Verdict]) -> None:
        passes = [v for v in verdicts if v.passed]
        result.rejections = sorted((v for v in verdicts if not v.passed), key=lambda v: v.score, reverse=True)
        if not passes:
            return
        # CT noise is a ranking input, so it is read only for finalists.
        if self.ct.available:
            await asyncio.gather(*(self.add_ct_context(v.token) for v in passes))
            for verdict in passes:
                if verdict.token.ct_mentions is not None:
                    verdict.score -= min(verdict.token.ct_mentions, 50) * 0.3
        passes.sort(key=lambda v: v.score, reverse=True)
        result.passes = passes[: self.config.max_calls_per_report]

    # ---------------------------------------------------------------- ticker

    async def check(self, raw_query: str) -> tuple[Token | None, str]:
        """Resolve a CA, link or name to one token and read everything on it."""
        query: Query = parse_query(raw_query)
        note = ""

        if query.kind == "empty":
            return None, "Give me a contract address, a pump.fun link, or a name."

        token: Token | None = None
        if query.mint:
            token = Token(mint=query.mint, source="input")
        else:
            token, note = await self._resolve_by_name(query.text or "")
            if token is None:
                return None, note

        pump_token = await self.pump.coin(token.mint)
        if pump_token is not None:
            pump_token.market = token.market
            pump_token.symbol = pump_token.symbol or token.symbol
            pump_token.name = pump_token.name or token.name
            token = pump_token

        await self.dex.enrich(token)
        await self.confirm_on_chain(token)
        await self.add_ct_context(token)

        if not token.authorities.checked and token.market.pair_address is None:
            note = note or (
                "Nothing on chain and nothing on Dexscreener for that address. "
                "Either it does not exist or it has never traded."
            )
        if not self.ct.available:
            note = (note + " " if note else "") + f"CT flood check skipped: {self.ct.unavailable_reason}."
        return token, note.strip()

    async def _resolve_by_name(self, text: str) -> tuple[Token | None, str]:
        """Name/ticker lookup. Ambiguity is reported, never resolved by guess."""
        try:
            pairs = await self.dex.search(text)
        except FetchError as exc:
            return None, f"Dexscreener search failed: {exc}"
        solana_pairs = [p for p in pairs if str(p.get("chainId")) == "solana"]
        if not solana_pairs:
            return None, f"No Solana pair on Dexscreener for {text!r}. Paste the contract."

        exact = [
            p
            for p in solana_pairs
            if str((p.get("baseToken") or {}).get("symbol", "")).lower() == text.lower()
        ]
        pool = exact or solana_pairs
        pair = best_pair(pool)
        if pair is None:
            return None, f"No usable pair for {text!r}."
        base = pair.get("baseToken") or {}
        token = Token(
            mint=str(base.get("address") or ""),
            symbol=str(base.get("symbol") or ""),
            name=str(base.get("name") or ""),
            source="dexscreener",
        )
        token.market = parse_pair(pair)
        if not token.mint:
            return None, f"Dexscreener gave no contract for {text!r}."
        note = ""
        if len(pool) > 1:
            note = (
                f"{len(pool)} Solana pairs match {text!r}; showing the deepest "
                "liquidity. Paste the contract if you meant another."
            )
        return token, note

    # --------------------------------------------------------------- culture

    async def culture_scan(self) -> tuple[list[CultureHit], dict[str, Token | None], str]:
        """What is spreading on X outside CT, and whether a coin exists yet."""
        if not self.ct.available:
            return [], {}, f"Culture scan cannot run: {self.ct.unavailable_reason}."
        try:
            hits = await self.ct.culture_candidates(list(CULTURE_QUERIES))
        except FetchError as exc:
            return [], {}, f"Culture scan failed: {exc}"
        matches: dict[str, Token | None] = {}
        for hit in hits:
            token, _ = await self._resolve_by_name(hit.phrase)
            matches[hit.phrase] = token
        return hits, matches, ""
