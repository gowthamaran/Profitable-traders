"""The two passes described in the brief.

Rules that hold in both:
  * An unknown is never a pass. If we could not read mint authority, the coin
    does not clear the safety gate -- it goes to the unknowns list.
  * Every rejection carries the reason, so a scan can be argued with.
"""

from __future__ import annotations

from ..config import SecondaryFilter, TrenchFilter
from ..models import Token, Verdict


def _pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value:,.1f}%"


def _usd(value: float | None) -> str:
    return "n/a" if value is None else f"${value:,.0f}"


def buy_sell_ratio(token: Token) -> float | None:
    """Buy pressure over the freshest window that has enough prints."""
    for buys, sells in (
        (token.market.buys_h1, token.market.sells_h1),
        (token.market.buys_h6, token.market.sells_h6),
    ):
        if buys is None or sells is None:
            continue
        if buys + sells == 0:
            continue
        if sells == 0:
            return float(buys)
        return buys / sells
    return None


def txn_count(token: Token) -> int | None:
    for buys, sells in (
        (token.market.buys_h1, token.market.sells_h1),
        (token.market.buys_h6, token.market.sells_h6),
    ):
        if buys is not None and sells is not None:
            return buys + sells
    return None


def check_safety(token: Token, rules: TrenchFilter, verdict: Verdict) -> None:
    """Mint and freeze must be dead, and we must have seen that ourselves."""
    auth = token.authorities
    if not auth.checked:
        verdict.unknowns.append("mint/freeze authority unreadable")
        verdict.fail("authorities not confirmed")
        return
    if rules.require_mint_revoked and not auth.mint_revoked:
        verdict.fail(f"mint authority live ({auth.mint_authority})")
    if rules.require_freeze_revoked and not auth.freeze_revoked:
        verdict.fail(f"freeze authority live ({auth.freeze_authority})")


def check_clustering(token: Token, rules: TrenchFilter, verdict: Verdict) -> None:
    clustered = token.holders.is_clustered(rules.max_top_holder_pct)
    if clustered is None:
        verdict.unknowns.append(f"holder spread unread ({token.holders.note or 'no data'})")
        verdict.fail("holder spread not confirmed")
        return
    if clustered:
        verdict.fail(
            f"clustered: top {token.holders.depth} hold {_pct(token.holders.top_holder_pct)}"
            f" (limit {_pct(rules.max_top_holder_pct)})"
        )


def evaluate_trench(token: Token, rules: TrenchFilter) -> Verdict:
    """30-70% bonded, mint+freeze dead, not clustered, buys up."""
    verdict = Verdict(token=token, passed=True)

    if token.bonded_pct is None:
        verdict.unknowns.append("bonding progress unknown")
        verdict.fail("bonding progress not confirmed")
    elif not (rules.bonded_min_pct <= token.bonded_pct <= rules.bonded_max_pct):
        verdict.fail(
            f"bonded {_pct(token.bonded_pct)} outside "
            f"{_pct(rules.bonded_min_pct)}-{_pct(rules.bonded_max_pct)}"
        )

    age = token.age_hours
    if age is not None and age > rules.max_age_hours:
        verdict.fail(f"stale on the curve: {age:,.0f}h old")

    check_safety(token, rules, verdict)
    check_clustering(token, rules, verdict)

    ratio = buy_sell_ratio(token)
    count = txn_count(token)
    if ratio is None:
        verdict.unknowns.append("no trade flow on Dexscreener yet")
        verdict.fail("buy pressure not confirmed")
    else:
        if count is not None and count < rules.min_txns:
            verdict.fail(f"thin flow: {count} txns (min {rules.min_txns})")
        if ratio < rules.min_buy_sell_ratio:
            verdict.fail(f"buys not up: ratio {ratio:.2f} (min {rules.min_buy_sell_ratio:.2f})")

    verdict.score = score_trench(token, ratio)
    return verdict


def score_trench(token: Token, ratio: float | None) -> float:
    """Rank order only. It never overrides a rule; it sorts the survivors."""
    score = 0.0
    if ratio is not None:
        score += min(ratio, 5.0) * 10
    if token.bonded_pct is not None:
        # Mid-curve is the interesting part of the range.
        score += 20 - abs(50.0 - token.bonded_pct) * 0.4
    if token.holders.top_holder_pct is not None:
        score += max(0.0, 25.0 - token.holders.top_holder_pct)
    if token.market.volume_h1:
        score += min(token.market.volume_h1 / 10_000, 20.0)
    if token.ct_mentions is not None:
        # Already loud is worth less, not more.
        score -= min(token.ct_mentions, 50) * 0.3
    return round(score, 2)


def volume_recovery(token: Token) -> float | None:
    """Recent pace against the trailing day's pace. >1 means volume is back."""
    v6, v24 = token.market.volume_h6, token.market.volume_h24
    if not v6 or not v24 or v24 <= 0:
        return None
    return (v6 / 6.0) / (v24 / 24.0)


def liquidity_ratio(token: Token) -> float | None:
    mcap = token.market_cap_usd
    lp = token.market.liquidity_usd
    if not mcap or lp is None or mcap <= 0:
        return None
    return lp / mcap


def evaluate_secondary(token: Token, rules: SecondaryFilter) -> Verdict:
    """7d+, $2m-$25m, LP not thin, volume back after the dump."""
    verdict = Verdict(token=token, passed=True)

    age_days = token.market.age_days
    if age_days is None:
        verdict.unknowns.append("pair age unknown")
        verdict.fail("age not confirmed")
    elif age_days < rules.min_age_days:
        verdict.fail(f"too young: {age_days:,.1f}d (min {rules.min_age_days:,.0f}d)")

    mcap = token.market_cap_usd
    if mcap is None:
        verdict.unknowns.append("market cap unknown")
        verdict.fail("market cap not confirmed")
    elif not (rules.min_market_cap_usd <= mcap <= rules.max_market_cap_usd):
        verdict.fail(
            f"mcap {_usd(mcap)} outside {_usd(rules.min_market_cap_usd)}-{_usd(rules.max_market_cap_usd)}"
        )

    lp = token.market.liquidity_usd
    ratio = liquidity_ratio(token)
    if lp is None:
        verdict.unknowns.append("liquidity unknown")
        verdict.fail("liquidity not confirmed")
    else:
        if lp < rules.min_liquidity_usd:
            verdict.fail(f"LP thin: {_usd(lp)} (min {_usd(rules.min_liquidity_usd)})")
        elif ratio is not None and ratio < rules.min_liquidity_ratio:
            verdict.fail(
                f"LP thin vs mcap: {ratio * 100:,.1f}% (min {rules.min_liquidity_ratio * 100:,.1f}%)"
            )

    drawdown = token.market.price_change_h24
    recovery = volume_recovery(token)
    if recovery is None:
        verdict.unknowns.append("volume history incomplete")
        verdict.fail("volume recovery not confirmed")
    elif recovery < rules.min_volume_recovery:
        verdict.fail(f"volume still fading: {recovery:.2f}x (min {rules.min_volume_recovery:.2f}x)")

    if drawdown is not None and drawdown > 0 and (token.market.price_change_h6 or 0) > 0:
        # Nothing to recover from; this is just a coin going up.
        if drawdown > abs(rules.max_drawdown_pct):
            verdict.fail(f"no dump to recover from: 24h {drawdown:+,.1f}%")

    verdict.score = score_secondary(token, recovery, ratio)
    return verdict


def score_secondary(token: Token, recovery: float | None, lp_ratio: float | None) -> float:
    score = 0.0
    if recovery is not None:
        score += min(recovery, 6.0) * 12
    if lp_ratio is not None:
        score += min(lp_ratio * 100, 30.0)
    if token.market.price_change_h6 is not None:
        score += max(-20.0, min(token.market.price_change_h6 * 0.3, 20.0))
    if token.ct_mentions is not None:
        score -= min(token.ct_mentions, 50) * 0.3
    return round(score, 2)
