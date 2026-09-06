"""Turn whatever was pasted into a mint address.

A contract is only ever read out of the input or returned by a source. If we
cannot find one, we say so -- we never construct an address that looks right.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

BASE58_RE = re.compile(r"[1-9A-HJ-NP-Za-km-z]{32,44}")
PUMP_URL_RE = re.compile(r"pump\.fun/(?:coin/)?([1-9A-HJ-NP-Za-km-z]{32,44})", re.IGNORECASE)
DEX_URL_RE = re.compile(r"dexscreener\.com/[a-z]+/([1-9A-HJ-NP-Za-km-z]{32,44})", re.IGNORECASE)
SOLSCAN_RE = re.compile(r"solscan\.io/(?:token|account)/([1-9A-HJ-NP-Za-km-z]{32,44})", re.IGNORECASE)
CASHTAG_RE = re.compile(r"\$([A-Za-z][A-Za-z0-9_]{1,14})\b")


@dataclass(slots=True)
class Query:
    """What the user gave us, classified."""

    raw: str
    mint: str | None = None
    text: str | None = None

    @property
    def kind(self) -> str:
        if self.mint:
            return "mint"
        return "text" if self.text else "empty"


def parse_query(raw: str) -> Query:
    text = (raw or "").strip()
    if not text:
        return Query(raw=raw)

    for pattern in (PUMP_URL_RE, DEX_URL_RE, SOLSCAN_RE):
        match = pattern.search(text)
        if match:
            return Query(raw=raw, mint=match.group(1))

    # A bare address, possibly with surrounding words.
    if not text.startswith("http"):
        for candidate in BASE58_RE.findall(text):
            # Base58 has no 0/O/I/l; a 32+ char run that survives that filter
            # is an address, not an English word.
            if len(candidate) >= 32:
                return Query(raw=raw, mint=candidate)

    cashtag = CASHTAG_RE.search(text)
    if cashtag:
        return Query(raw=raw, text=cashtag.group(1))
    return Query(raw=raw, text=text.lstrip("$"))
