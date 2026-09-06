"""Job callbacks for the scheduler.

Each job does the same three things: run a pass, drop names we already called
inside the suppression window, and stay silent when nothing clears. Silence on
an unattended job is the point -- a report with nothing in it is noise.
"""

from __future__ import annotations

import logging

from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .. import formatting
from ..scanner import ScanResult

log = logging.getLogger(__name__)

TRENCH = "trench"
SECONDARY = "secondary"
CULTURE = "culture"

TITLES = {
    TRENCH: "Trench scan",
    SECONDARY: "Secondary scan",
    CULTURE: "Culture scan",
}


async def _send(context: ContextTypes.DEFAULT_TYPE, chat_id: int, text: str) -> None:
    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )


async def run_scan(
    context: ContextTypes.DEFAULT_TYPE,
    scan: str,
    chat_id: int,
    *,
    quiet_when_empty: bool,
) -> ScanResult | None:
    """Shared body for both the scheduled job and the manual command."""
    app_state = context.application.bot_data
    scanner = app_state["scanner"]
    store = app_state["store"]
    config = app_state["config"]

    exclude = await store.recently_called(scan, config.repeat_suppression_hours)
    if scan == TRENCH:
        result = await scanner.trench_scan(exclude=exclude)
    elif scan == SECONDARY:
        result = await scanner.secondary_scan(exclude=exclude)
    else:
        raise ValueError(f"unknown scan {scan!r}")

    app_state.setdefault("last_rejections", {})[scan] = result.rejections

    if not result.passes and quiet_when_empty:
        log.info("%s scan: nothing cleared out of %d", scan, result.screened)
        return result

    await _send(
        context,
        chat_id,
        formatting.scan_report(TITLES[scan], result.passes, screened=result.screened, note=result.note),
    )
    await store.record_calls(scan, [v.token.mint for v in result.passes])
    return result


def _broadcast_chat(context: ContextTypes.DEFAULT_TYPE) -> int | None:
    config = context.application.bot_data["config"]
    if config.broadcast_chat_id:
        return config.broadcast_chat_id
    return config.allowed_chat_ids[0] if config.allowed_chat_ids else None


async def trench_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = _broadcast_chat(context)
    if chat_id is None:
        return
    if not await _enabled(context, TRENCH):
        return
    try:
        await run_scan(context, TRENCH, chat_id, quiet_when_empty=True)
    except Exception as exc:  # a scheduled job must not die on one bad response
        log.exception("trench job failed")
        await _send(context, chat_id, formatting.error_note("Trench scan", exc))


async def secondary_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = _broadcast_chat(context)
    if chat_id is None:
        return
    if not await _enabled(context, SECONDARY):
        return
    try:
        await run_scan(context, SECONDARY, chat_id, quiet_when_empty=True)
    except Exception as exc:
        log.exception("secondary job failed")
        await _send(context, chat_id, formatting.error_note("Secondary scan", exc))


async def culture_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = _broadcast_chat(context)
    if chat_id is None:
        return
    if not await _enabled(context, CULTURE):
        return
    scanner = context.application.bot_data["scanner"]
    try:
        hits, matches, note = await scanner.culture_scan()
    except Exception as exc:
        log.exception("culture job failed")
        await _send(context, chat_id, formatting.error_note("Culture scan", exc))
        return
    if note and not hits:
        log.info("culture job idle: %s", note)
        return
    await _send(context, chat_id, formatting.culture_report(hits, matches))


async def prune_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    store = context.application.bot_data["store"]
    removed = await store.prune()
    if removed:
        log.info("pruned %d stale call records", removed)


async def _enabled(context: ContextTypes.DEFAULT_TYPE, name: str) -> bool:
    """Stored state wins over the env default, so /on and /off survive restarts."""
    store = context.application.bot_data["store"]
    config = context.application.bot_data["config"]
    stored = await store.get_job_enabled(name)
    if stored is not None:
        return stored
    return {
        TRENCH: config.trench_enabled,
        SECONDARY: config.secondary_enabled,
        CULTURE: config.culture_enabled,
    }[name]
