from __future__ import annotations

from sri_wagmi.analysis.filters import (
    buy_sell_ratio,
    evaluate_secondary,
    evaluate_trench,
    liquidity_ratio,
    volume_recovery,
)
from sri_wagmi.config import SecondaryFilter, TrenchFilter
from sri_wagmi.models import HolderSpread, MintAuthorities

TRENCH = TrenchFilter(
    bonded_min_pct=30.0,
    bonded_max_pct=70.0,
    require_mint_revoked=True,
    require_freeze_revoked=True,
    max_top_holder_pct=25.0,
    top_holder_depth=10,
    min_buy_sell_ratio=1.3,
    min_txns=30,
    max_age_hours=48.0,
)

SECONDARY = SecondaryFilter(
    min_age_days=7.0,
    min_market_cap_usd=2_000_000.0,
    max_market_cap_usd=25_000_000.0,
    min_liquidity_ratio=0.03,
    min_liquidity_usd=80_000.0,
    min_volume_recovery=1.2,
    max_drawdown_pct=-15.0,
)


def test_clean_token_passes_trench(clean_token):
    verdict = evaluate_trench(clean_token, TRENCH)
    assert verdict.passed, verdict.reasons


def test_bonding_below_band_is_rejected(clean_token):
    clean_token.bonded_pct = 12.0
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert "bonded" in verdict.reasons[0]


def test_bonding_above_band_is_rejected(clean_token):
    clean_token.bonded_pct = 88.0
    assert not evaluate_trench(clean_token, TRENCH).passed


def test_live_mint_authority_is_rejected(clean_token):
    clean_token.authorities.mint_authority = "Auth11111111111111111111111111111111111111"
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert any("mint authority live" in r for r in verdict.reasons)


def test_live_freeze_authority_is_rejected(clean_token):
    clean_token.authorities.freeze_authority = "Frz111111111111111111111111111111111111111"
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert any("freeze authority live" in r for r in verdict.reasons)


def test_unread_authorities_never_pass(clean_token):
    """An unknown is not a pass. This is the rule the whole tool rests on."""
    clean_token.authorities = MintAuthorities()
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert verdict.unknowns


def test_clustered_holders_are_rejected(clean_token):
    clean_token.holders = HolderSpread(top_holder_pct=61.0, depth=10, checked=True)
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert any("clustered" in r for r in verdict.reasons)


def test_unread_holders_never_pass(clean_token):
    clean_token.holders = HolderSpread(checked=False, note="rpc refused")
    assert not evaluate_trench(clean_token, TRENCH).passed


def test_sells_outweighing_buys_is_rejected(clean_token):
    clean_token.market.buys_h1 = 40
    clean_token.market.sells_h1 = 120
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert any("buys not up" in r for r in verdict.reasons)


def test_thin_flow_is_rejected(clean_token):
    clean_token.market.buys_h1 = 6
    clean_token.market.sells_h1 = 2
    verdict = evaluate_trench(clean_token, TRENCH)
    assert not verdict.passed
    assert any("thin flow" in r for r in verdict.reasons)


def test_buy_sell_ratio_falls_back_to_six_hour_window(clean_token):
    clean_token.market.buys_h1 = None
    clean_token.market.sells_h1 = None
    assert buy_sell_ratio(clean_token) == 600 / 400


def test_zero_sells_does_not_divide_by_zero(clean_token):
    clean_token.market.buys_h1 = 25
    clean_token.market.sells_h1 = 0
    assert buy_sell_ratio(clean_token) == 25.0


def test_survivor_passes_secondary(survivor_token):
    verdict = evaluate_secondary(survivor_token, SECONDARY)
    assert verdict.passed, verdict.reasons


def test_secondary_rejects_young_pair(survivor_token):
    survivor_token.market.pair_created_at_ms = None
    assert not evaluate_secondary(survivor_token, SECONDARY).passed


def test_secondary_rejects_market_cap_outside_band(survivor_token):
    survivor_token.market.market_cap_usd = 90_000_000.0
    verdict = evaluate_secondary(survivor_token, SECONDARY)
    assert not verdict.passed
    assert any("mcap" in r for r in verdict.reasons)


def test_secondary_rejects_thin_lp(survivor_token):
    survivor_token.market.liquidity_usd = 20_000.0
    verdict = evaluate_secondary(survivor_token, SECONDARY)
    assert not verdict.passed
    assert any("LP thin" in r for r in verdict.reasons)


def test_secondary_rejects_lp_thin_against_market_cap(survivor_token):
    survivor_token.market.liquidity_usd = 100_000.0
    survivor_token.market.market_cap_usd = 20_000_000.0
    verdict = evaluate_secondary(survivor_token, SECONDARY)
    assert not verdict.passed
    assert any("LP thin vs mcap" in r for r in verdict.reasons)


def test_secondary_rejects_fading_volume(survivor_token):
    survivor_token.market.volume_h6 = 60_000.0
    survivor_token.market.volume_h24 = 1_200_000.0
    verdict = evaluate_secondary(survivor_token, SECONDARY)
    assert not verdict.passed
    assert any("volume still fading" in r for r in verdict.reasons)


def test_volume_recovery_maths(survivor_token):
    # 600k over 6h against 1.2m over 24h -> twice the trailing pace.
    assert volume_recovery(survivor_token) == 2.0


def test_liquidity_ratio_maths(survivor_token):
    assert liquidity_ratio(survivor_token) == 600_000.0 / 8_000_000.0


def test_missing_volume_history_is_unknown_not_pass(survivor_token):
    survivor_token.market.volume_h6 = None
    verdict = evaluate_secondary(survivor_token, SECONDARY)
    assert not verdict.passed
    assert verdict.unknowns
