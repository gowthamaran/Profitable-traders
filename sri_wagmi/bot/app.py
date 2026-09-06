"""Application wiring: build the bot, own the HTTP session, schedule the jobs."""

from __future__ import annotations

import logging

from telegram import BotCommand, Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
)

from ..config import Config, load_config
from ..jobs import scans
from ..scanner import Scanner
from ..sources.http import HttpClient
from ..state import Store
from . import handlers

log = logging.getLogger(__name__)

COMMANDS = [
    BotCommand("check", "Read a contract, pump.fun link or name"),
    BotCommand("scan", "Run the trench pass now"),
    BotCommand("secondary", "Run the survivors pass now"),
    BotCommand("culture", "One-off culture scan"),
    BotCommand("jobs", "What is running"),
    BotCommand("why", "Why the last batch was rejected"),
    BotCommand("thresholds", "The exact filter numbers"),
    BotCommand("help", "What I can do"),
]


async def _post_init(app: Application) -> None:
    config: Config = app.bot_data["config"]
    http: HttpClient = app.bot_data["http"]
    store: Store = app.bot_data["store"]
    await http.start()
    await store.init()
    await app.bot.set_my_commands(COMMANDS)
    log.info(
        "up. trench=%s secondary=%s culture=%s",
        config.trench_enabled,
        config.secondary_enabled,
        config.culture_enabled,
    )


async def _post_shutdown(app: Application) -> None:
    http: HttpClient | None = app.bot_data.get("http")
    if http is not None:
        await http.close()


def build_application(config: Config | None = None) -> Application:
    config = config or load_config()
    config.validate()

    http = HttpClient(config.http_timeout_seconds, config.http_max_concurrency)
    scanner = Scanner(config, http)
    store = Store(config.state_path)

    app = (
        ApplicationBuilder()
        .token(config.telegram_token)
        .post_init(_post_init)
        .post_shutdown(_post_shutdown)
        .build()
    )
    app.bot_data.update(
        {"config": config, "http": http, "scanner": scanner, "store": store, "last_rejections": {}}
    )

    app.add_handler(CommandHandler("start", handlers.start))
    app.add_handler(CommandHandler("help", handlers.help_command))
    app.add_handler(CommandHandler("whoami", handlers.whoami))
    app.add_handler(CommandHandler("check", handlers.check))
    app.add_handler(CommandHandler("scan", handlers.scan))
    app.add_handler(CommandHandler("secondary", handlers.secondary))
    app.add_handler(CommandHandler("culture", handlers.culture))
    app.add_handler(CommandHandler("jobs", handlers.jobs))
    app.add_handler(CommandHandler("on", handlers.job_on))
    app.add_handler(CommandHandler("off", handlers.job_off))
    app.add_handler(CommandHandler("why", handlers.why))
    app.add_handler(CommandHandler("thresholds", handlers.thresholds))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handlers.on_text))

    schedule_jobs(app, config)
    return app


def schedule_jobs(app: Application, config: Config) -> None:
    """Jobs are always scheduled; each one checks its own on/off state when it
    fires, so /on and /off take effect without touching the scheduler."""
    queue = app.job_queue
    if queue is None:
        log.warning("no job queue available; scheduled scans are off")
        return
    queue.run_repeating(
        scans.trench_job, interval=config.trench_interval_seconds, first=30, name=scans.TRENCH
    )
    queue.run_repeating(
        scans.secondary_job,
        interval=config.secondary_interval_seconds,
        first=90,
        name=scans.SECONDARY,
    )
    queue.run_repeating(
        scans.culture_job, interval=config.culture_interval_seconds, first=300, name=scans.CULTURE
    )
    queue.run_repeating(scans.prune_job, interval=6 * 3600, first=600, name="prune")


def run() -> None:
    config = load_config()
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    app = build_application(config)
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)
