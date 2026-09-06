"""Command handlers.

House rules, visible in the code because they are the product:
  * The bot answers only the chats in ALLOWED_CHAT_IDS.
  * A check reports what was read and what could not be read. No invented
    contracts, no filled-in numbers.
  * Manual scans print even when empty; scheduled ones stay quiet.
"""

from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .. import formatting
from ..jobs.scans import CULTURE, SECONDARY, TITLES, TRENCH, _enabled, run_scan
from ..resolve import parse_query

log = logging.getLogger(__name__)

JOB_NAMES = (TRENCH, SECONDARY, CULTURE)

HELP = """<b>Sri WAGMI</b>
What I can do from this box, not a pitch.

<b>Watch</b>
/scan - run the trench pass now: 30-70% bonded, mint+freeze dead, not clustered, buys up.
/secondary - 7d+, $2m-$25m, LP not thin, volume back after the dump.
/culture - one-off: what is spreading on X outside CT, then whether a coin exists.
Max {max_calls} names or silence.

<b>Check a ticker</b>
/check &lt;CA | pump.fun link | name&gt; - mint, freeze, LP, age, mc, volume, whether CT already flooded it.
I will not invent a contract.

<b>Control</b>
/jobs - what is running
/on &lt;job&gt; , /off &lt;job&gt; - jobs: trench, secondary, culture
/why [job] - why the last batch was rejected
/thresholds - the exact numbers I filter on

What I cannot do: read GMGN unique holders (Cloudflare blocks the client),
see one entity behind many wallets, or tell you what a chart does next."""


def authorised(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    config = context.application.bot_data["config"]
    chat = update.effective_chat
    return bool(chat and chat.id in config.allowed_chat_ids)


async def _reply(update: Update, text: str) -> None:
    if update.effective_message is None:
        return
    await update.effective_message.reply_text(text, parse_mode=ParseMode.HTML, disable_web_page_preview=True)


async def guard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    if authorised(update, context):
        return True
    chat = update.effective_chat
    log.warning("ignored command from unauthorised chat %s", chat.id if chat else "?")
    return False


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    config = context.application.bot_data["config"]
    await _reply(update, HELP.format(max_calls=config.max_calls_per_report))


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await start(update, context)


async def whoami(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Unguarded on purpose: this is how you find your chat id to allowlist."""
    chat = update.effective_chat
    if chat is None:
        return
    await _reply(update, f"chat id: <code>{chat.id}</code>")


async def check(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    raw = " ".join(context.args or []).strip()
    if not raw and update.effective_message and update.effective_message.reply_to_message:
        raw = update.effective_message.reply_to_message.text or ""
    if not raw:
        await _reply(update, "Paste a contract, a pump.fun link, or a name.")
        return
    await run_check(update, context, raw)


async def run_check(update: Update, context: ContextTypes.DEFAULT_TYPE, raw: str) -> None:
    """Shared by /check and by a contract pasted straight into the chat."""
    scanner = context.application.bot_data["scanner"]
    await _reply(update, "Reading it.")
    try:
        token, note = await scanner.check(raw)
    except Exception as exc:
        log.exception("check failed for %r", raw)
        await _reply(update, formatting.error_note("Check", exc))
        return
    if token is None:
        await _reply(update, formatting.esc(note))
        return
    await _reply(update, formatting.ticker_report(token, resolution_note=note))


async def scan(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    await _run_manual(update, context, TRENCH)


async def secondary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    await _run_manual(update, context, SECONDARY)


async def _run_manual(update: Update, context: ContextTypes.DEFAULT_TYPE, name: str) -> None:
    chat = update.effective_chat
    if chat is None:
        return
    await _reply(update, f"{TITLES[name]} running.")
    try:
        await run_scan(context, name, chat.id, quiet_when_empty=False)
    except Exception as exc:
        log.exception("%s scan failed", name)
        await _reply(update, formatting.error_note(TITLES[name], exc))


async def culture(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    scanner = context.application.bot_data["scanner"]
    await _reply(update, "Culture scan running. One off.")
    try:
        hits, matches, note = await scanner.culture_scan()
    except Exception as exc:
        log.exception("culture scan failed")
        await _reply(update, formatting.error_note("Culture scan", exc))
        return
    if note and not hits:
        await _reply(update, formatting.esc(note))
        return
    await _reply(update, formatting.culture_report(hits, matches))


async def jobs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    config = context.application.bot_data["config"]
    intervals = {
        TRENCH: config.trench_interval_seconds,
        SECONDARY: config.secondary_interval_seconds,
        CULTURE: config.culture_interval_seconds,
    }
    lines = ["<b>Jobs</b>"]
    for name in JOB_NAMES:
        state = "on" if await _enabled(context, name) else "off"
        lines.append(f"{name}: <b>{state}</b> every {intervals[name] // 60}m")
    lines.append(f"max {config.max_calls_per_report} names per report, else silence.")
    lines.append(f"repeat suppression: {config.repeat_suppression_hours:g}h")
    await _reply(update, "\n".join(lines))


async def job_on(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _set_job(update, context, True)


async def job_off(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _set_job(update, context, False)


async def _set_job(update: Update, context: ContextTypes.DEFAULT_TYPE, enabled: bool) -> None:
    if not await guard(update, context):
        return
    name = (context.args[0].lower() if context.args else "").strip()
    if name not in JOB_NAMES:
        await _reply(update, f"Which job? {', '.join(JOB_NAMES)}")
        return
    store = context.application.bot_data["store"]
    await store.set_job_enabled(name, enabled)
    await _reply(update, f"{name}: <b>{'on' if enabled else 'off'}</b>")


async def why(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    name = (context.args[0].lower() if context.args else TRENCH).strip()
    if name not in JOB_NAMES:
        await _reply(update, f"Which job? {', '.join(JOB_NAMES)}")
        return
    rejections = context.application.bot_data.get("last_rejections", {}).get(name, [])
    await _reply(update, formatting.rejection_report(rejections))


async def thresholds(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await guard(update, context):
        return
    config = context.application.bot_data["config"]
    t, s = config.trench, config.secondary
    lines = [
        "<b>Trench</b>",
        f"bonded {t.bonded_min_pct:g}-{t.bonded_max_pct:g}%",
        f"mint revoked: {t.require_mint_revoked} | freeze revoked: {t.require_freeze_revoked}",
        f"top {t.top_holder_depth} non-pool holders under {t.max_top_holder_pct:g}%",
        f"buy/sell at least {t.min_buy_sell_ratio:g}x over {t.min_txns}+ txns",
        "",
        "<b>Secondary</b>",
        f"age {s.min_age_days:g}d+",
        f"mcap ${s.min_market_cap_usd / 1e6:g}m-${s.max_market_cap_usd / 1e6:g}m",
        f"LP at least ${s.min_liquidity_usd / 1e3:g}k and {s.min_liquidity_ratio * 100:g}% of mcap",
        f"6h volume pace at least {s.min_volume_recovery:g}x the 24h pace",
    ]
    await _reply(update, "\n".join(lines))


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """A bare contract or pump link pasted into the chat is a check."""
    if not await guard(update, context):
        return
    message = update.effective_message
    if message is None or not message.text:
        return
    query = parse_query(message.text)
    if query.kind != "mint" or not query.mint:
        return
    await run_check(update, context, query.mint)
