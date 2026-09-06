from __future__ import annotations

import pytest

from sri_wagmi.resolve import parse_query

MINT = "8x9c1v9BJmXsvKf2Xa1o8N2gT7pQwR3sMzYbEd4Hn5Ka"


@pytest.mark.parametrize(
    "raw",
    [
        MINT,
        f"  {MINT}  ",
        f"https://pump.fun/coin/{MINT}",
        f"https://pump.fun/{MINT}",
        f"https://dexscreener.com/solana/{MINT}",
        f"https://solscan.io/token/{MINT}",
        f"wdyt about {MINT}",
    ],
)
def test_addresses_and_links_resolve_to_a_mint(raw):
    query = parse_query(raw)
    assert query.kind == "mint"
    assert query.mint == MINT


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("$WIF", "WIF"), ("wif", "wif"), ("check $BONK for me", "BONK"), ("book of meme", "book of meme")],
)
def test_names_stay_text(raw, expected):
    query = parse_query(raw)
    assert query.kind == "text"
    assert query.text == expected


def test_empty_input_is_empty():
    assert parse_query("   ").kind == "empty"


def test_ordinary_words_are_never_read_as_a_contract():
    """Base58 excludes 0, O, I and l, but a long word must still not match."""
    query = parse_query("absolutelyunbelievablemarketconditions")
    assert query.kind == "text"
