from __future__ import annotations

from sri_wagmi import formatting
from sri_wagmi.models import HolderSpread, MintAuthorities, Token, Verdict


def test_usd_scales_by_magnitude():
    assert formatting.usd(4_200_000) == "$4.20m"
    assert formatting.usd(8_500) == "$8.5k"
    assert formatting.usd(12.5) == "$12.50"
    assert formatting.usd(None) == "n/a"


def test_age_reads_naturally():
    assert formatting.age(0.5) == "30m"
    assert formatting.age(6) == "6.0h"
    assert formatting.age(72) == "3.0d"
    assert formatting.age(None) == "n/a"


def test_unread_authorities_are_labelled_not_assumed(clean_token):
    clean_token.authorities = MintAuthorities()
    assert "unread" in formatting.authority_line(clean_token)


def test_live_authority_is_shown_with_the_address(clean_token):
    clean_token.authorities.mint_authority = "Auth1"
    line = formatting.authority_line(clean_token)
    assert "LIVE (Auth1)" in line


def test_unread_holders_are_labelled(clean_token):
    clean_token.holders = HolderSpread(checked=False, note="rpc refused")
    assert "unread" in formatting.holder_line(clean_token)
    assert "rpc refused" in formatting.holder_line(clean_token)


def test_ct_line_distinguishes_quiet_from_unchecked(clean_token):
    assert formatting.ct_line(clean_token) == "CT: not checked"
    clean_token.ct_mentions = 0
    assert formatting.ct_line(clean_token) == "CT: quiet"
    clean_token.ct_mentions = 41
    assert "41 recent posts" in formatting.ct_line(clean_token)


def test_empty_scan_says_nothing_cleared():
    report = formatting.scan_report("Trench scan", [], screened=57)
    assert "Nothing cleared" in report
    assert "57 screened" in report


def test_scan_report_lists_the_names(clean_token):
    report = formatting.scan_report(
        "Trench scan", [Verdict(token=clean_token, passed=True, score=42.0)], screened=57
    )
    assert "$CLEAN" in report
    assert clean_token.mint in report
    assert "1 named" in report


def test_html_in_a_coin_name_is_escaped():
    """Coin names come from strangers; they are rendered, never executed."""
    token = Token(mint="MINT", symbol="<b>rug</b>", name="<script>x</script>")
    block = formatting.token_block(token)
    assert "<script>" not in block
    assert "&lt;script&gt;" in block


def test_rejection_report_gives_the_reason(clean_token):
    verdict = Verdict(token=clean_token, passed=False, reasons=["mint authority live (Auth1)"])
    report = formatting.rejection_report([verdict])
    assert "mint authority live" in report


def test_ticker_report_carries_the_disclaimer(clean_token):
    assert formatting.DISCLAIMER in formatting.ticker_report(clean_token)
