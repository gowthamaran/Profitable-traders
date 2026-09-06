"""Telegram output. Terse on purpose: numbers, sources, no adjectives.

Everything rendered here is HTML parse mode, so any upstream string (a coin
name, a tweet) goes through `esc` before it reaches a message.
"""

from __future__ import annotations

from html import escape

from .analysis.filters import buy_sell_ratio, liquidity_ratio, txn_count, volume_recovery
from .models import Token, Verdict
from .sources.ct import CultureHit

DISCLAIMER = "Not advice. Numbers only. You size it."


def esc(text: object) -> str:
    return escape(str(text), quote=False)


def usd(value: float | None) -> str:
    if value is None:
        return "n/a"
    if value >= 1_000_000:
        return f"${value / 1_000_000:,.2f}m"
    if value >= 1_000:
        return f"${value / 1_000:,.1f}k"
    if value >= 1:
        return f"${value:,.2f}"
    return f"${value:.8f}".rstrip("0")


def pct(value: float | None, signed: bool = False) -> str:
    if value is None:
        return "n/a"
    return f"{value:+,.1f}%" if signed else f"{value:,.1f}%"


def age(hours: float | None) -> str:
    if hours is None:
        return "n/a"
    if hours < 1:
        return f"{hours * 60:,.0f}m"
    if hours < 48:
        return f"{hours:,.1f}h"
    return f"{hours / 24:,.1f}d"


def authority_line(token: Token) -> str:
    auth = token.authorities
    if not auth.checked:
        return "mint/freeze: <b>unread</b>"
    mint = "dead" if auth.mint_revoked else f"LIVE ({esc(auth.mint_authority)})"
    freeze = "dead" if auth.freeze_revoked else f"LIVE ({esc(auth.freeze_authority)})"
    return f"mint: {mint} | freeze: {freeze}"


def holder_line(token: Token) -> str:
    spread = token.holders
    if not spread.checked or spread.top_holder_pct is None:
        return f"holders: <b>unread</b> ({esc(spread.note or 'no data')})"
    return f"top {spread.depth} non-pool: {pct(spread.top_holder_pct)}"


def ct_line(token: Token) -> str:
    if token.ct_mentions is None:
        return "CT: not checked"
    if token.ct_mentions == 0:
        return "CT: quiet"
    return f"CT: {token.ct_mentions} recent posts"


def token_block(token: Token, *, score: float | None = None) -> str:
    ratio = buy_sell_ratio(token)
    lines = [
        f"<b>{esc(token.label)}</b>",
        f"<code>{esc(token.mint)}</code>",
        f"mc {usd(token.market_cap_usd)} | lp {usd(token.market.liquidity_usd)} | age {age(token.age_hours)}",
        f"vol 1h {usd(token.market.volume_h1)} | 6h {usd(token.market.volume_h6)}"
        f" | 24h {usd(token.market.volume_h24)}",
        f"24h {pct(token.market.price_change_h24, signed=True)}"
        f" | 6h {pct(token.market.price_change_h6, signed=True)}",
    ]
    if token.bonded_pct is not None:
        lines.insert(2, f"bonded {pct(token.bonded_pct)}")
    if ratio is not None:
        count = txn_count(token)
        lines.append(f"buy/sell {ratio:.2f}x" + (f" over {count} txns" if count else ""))
    recovery = volume_recovery(token)
    if recovery is not None:
        lines.append(f"vol recovery {recovery:.2f}x")
    lp_ratio = liquidity_ratio(token)
    if lp_ratio is not None:
        lines.append(f"lp/mc {pct(lp_ratio * 100)}")
    lines.append(authority_line(token))
    lines.append(holder_line(token))
    lines.append(ct_line(token))
    if score is not None:
        lines.append(f"score {score:g}")
    links = [f'<a href="{esc(token.dexscreener_url)}">dexscreener</a>']
    if token.source == "pump.fun" or not token.is_bonded:
        links.append(f'<a href="{esc(token.pump_url)}">pump.fun</a>')
    lines.append(" | ".join(links))
    return "\n".join(lines)


def scan_report(title: str, passes: list[Verdict], *, screened: int, note: str = "") -> str:
    """Max N names or silence -- the caller decides N, we render the outcome."""
    header = f"<b>{esc(title)}</b>"
    if not passes:
        body = f"Nothing cleared. {screened} screened."
        if note:
            body += f"\n{esc(note)}"
        return f"{header}\n{body}"
    blocks = [token_block(v.token, score=v.score) for v in passes]
    footer = f"{screened} screened, {len(passes)} named."
    if note:
        footer += f"\n{esc(note)}"
    return "\n\n".join([header, *blocks, footer])


def rejection_report(verdicts: list[Verdict], limit: int = 8) -> str:
    """Why the rest did not make it. Asked for explicitly, never pushed."""
    if not verdicts:
        return "Nothing screened yet."
    lines = ["<b>Rejections</b>"]
    for verdict in verdicts[:limit]:
        reason = verdict.reasons[0] if verdict.reasons else "no reason recorded"
        lines.append(f"{esc(verdict.token.label)} - {esc(reason)}")
    if len(verdicts) > limit:
        lines.append(f"...and {len(verdicts) - limit} more.")
    return "\n".join(lines)


def ticker_report(token: Token, *, resolution_note: str = "") -> str:
    lines = [token_block(token)]
    if resolution_note:
        lines.append(esc(resolution_note))
    lines.append(DISCLAIMER)
    return "\n\n".join(lines)


def culture_report(hits: list[CultureHit], matches: dict[str, Token | None]) -> str:
    if not hits:
        return "<b>Culture scan</b>\nNothing spreading outside CT worth naming."
    lines = ["<b>Culture scan</b>", "What is moving on X outside CT, and whether a coin exists yet."]
    for hit in hits:
        token = matches.get(hit.phrase)
        if token is None:
            state = "no coin found"
        else:
            state = (
                f"coin exists: <code>{esc(token.mint)}</code> "
                f"mc {usd(token.market_cap_usd)} lp {usd(token.market.liquidity_usd)}"
            )
        line = f"<b>${esc(hit.phrase)}</b> - {hit.mentions} posts - {state}"
        if hit.sample_url:
            line += f' - <a href="{esc(hit.sample_url)}">sample</a>'
        lines.append(line)
    lines.append("Existence is not a thesis. Check the contract before you touch it.")
    return "\n".join(lines)


def error_note(context: str, exc: Exception) -> str:
    return f"<b>{esc(context)} failed.</b>\n<code>{esc(exc)}</code>"
