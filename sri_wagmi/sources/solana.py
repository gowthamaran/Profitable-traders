"""Solana JSON-RPC: mint authority, freeze authority, holder concentration.

These are the only facts in the whole pipeline that come from chain rather
than from an indexer, which is exactly why the safety checks use them.
"""

from __future__ import annotations

import logging
from typing import Any

from ..models import HolderSpread, MintAuthorities
from .http import FetchError, HttpClient

log = logging.getLogger(__name__)

# Program-owned accounts that are pools or the pump.fun curve, not humans.
# Excluding them keeps a deep LP from reading as one whale.
POOL_OWNER_PROGRAMS = {
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",  # Raydium AMM v4
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",  # Raydium CLMM
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  # pump.fun bonding curve
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",  # PumpSwap AMM
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",  # Orca Whirlpools
}


class SolanaRpc:
    def __init__(self, http: HttpClient, url: str) -> None:
        self._http = http
        self._url = url
        self._id = 0

    async def _call(self, method: str, params: list[Any]) -> Any:
        self._id += 1
        payload = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params}
        data = await self._http.post_json(
            self._url, payload=payload, headers={"Content-Type": "application/json"}
        )
        if isinstance(data, dict) and data.get("error"):
            raise FetchError(f"rpc {method}: {data['error'].get('message', data['error'])}")
        return (data or {}).get("result")

    async def mint_authorities(self, mint: str) -> MintAuthorities:
        """Read the SPL mint account. Unset authority == revoked."""
        try:
            result = await self._call(
                "getAccountInfo", [mint, {"encoding": "jsonParsed", "commitment": "confirmed"}]
            )
        except FetchError as exc:
            log.info("mint authority read failed for %s: %s", mint, exc)
            return MintAuthorities()
        info = (((result or {}).get("value") or {}).get("data") or {}).get("parsed", {}).get("info")
        if not isinstance(info, dict):
            return MintAuthorities()
        decimals = info.get("decimals")
        supply_raw = info.get("supply")
        supply = None
        if supply_raw is not None and decimals is not None:
            try:
                supply = int(supply_raw) / (10 ** int(decimals))
            except (TypeError, ValueError):
                supply = None
        return MintAuthorities(
            mint_authority=info.get("mintAuthority"),
            freeze_authority=info.get("freezeAuthority"),
            supply=supply,
            decimals=int(decimals) if decimals is not None else None,
            checked=True,
        )

    async def holder_spread(self, mint: str, depth: int = 10) -> HolderSpread:
        """Share of supply held by the largest non-pool accounts.

        getTokenLargestAccounts returns the top 20 token accounts. That is not
        a full holder table -- it cannot see one entity behind many wallets --
        so we report what it shows and say what it misses.
        """
        try:
            result = await self._call("getTokenLargestAccounts", [mint, {"commitment": "confirmed"}])
        except FetchError as exc:
            return HolderSpread(checked=False, note=f"holder read failed: {exc}")
        values = (result or {}).get("value") or []
        if not values:
            return HolderSpread(checked=False, note="no token accounts returned")

        try:
            supply_result = await self._call("getTokenSupply", [mint, {"commitment": "confirmed"}])
            supply = float(((supply_result or {}).get("value") or {}).get("uiAmount") or 0.0)
        except FetchError as exc:
            return HolderSpread(checked=False, note=f"supply read failed: {exc}")
        if supply <= 0:
            return HolderSpread(checked=False, note="supply unavailable")

        owners = await self._owners([str(v.get("address")) for v in values[: depth * 2] if v.get("address")])
        held = 0.0
        counted = 0
        for value in values:
            if counted >= depth:
                break
            address = str(value.get("address") or "")
            owner = owners.get(address)
            if owner in POOL_OWNER_PROGRAMS:
                continue
            amount = float((value.get("uiAmount") or 0.0) or 0.0)
            held += amount
            counted += 1
        if counted == 0:
            return HolderSpread(checked=False, note="only pool accounts in the top holders")
        pct = 100.0 * held / supply
        return HolderSpread(
            top_holder_pct=round(pct, 2),
            depth=counted,
            checked=True,
            note="top-20 accounts only; wallets under one owner still read as many",
        )

    async def _owners(self, addresses: list[str]) -> dict[str, str]:
        """Owner program/wallet behind each token account, best effort."""
        if not addresses:
            return {}
        try:
            result = await self._call(
                "getMultipleAccounts",
                [addresses, {"encoding": "jsonParsed", "commitment": "confirmed"}],
            )
        except FetchError as exc:
            log.debug("owner lookup failed: %s", exc)
            return {}
        out: dict[str, str] = {}
        values = (result or {}).get("value") or []
        for address, account in zip(addresses, values, strict=False):
            info = ((account or {}).get("data") or {}).get("parsed", {}).get("info", {})
            owner = info.get("owner")
            if owner:
                out[address] = str(owner)
        return out
