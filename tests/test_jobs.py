"""Job on/off precedence and the access guard."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from sri_wagmi.bot.handlers import authorised
from sri_wagmi.config import Config
from sri_wagmi.jobs.scans import CULTURE, TRENCH, _enabled
from sri_wagmi.state import Store


def _context(config: Config, store: Store) -> SimpleNamespace:
    return SimpleNamespace(application=SimpleNamespace(bot_data={"config": config, "store": store}))


@pytest.fixture
def config(monkeypatch) -> Config:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x")
    monkeypatch.setenv("ALLOWED_CHAT_IDS", "4242")
    return Config()


@pytest.mark.asyncio
async def test_defaults_follow_the_brief(config, tmp_path):
    """Trench watches by default; the culture scan waits to be turned on."""
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    context = _context(config, store)
    assert await _enabled(context, TRENCH) is True
    assert await _enabled(context, CULTURE) is False


@pytest.mark.asyncio
async def test_stored_state_beats_the_env_default(config, tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    context = _context(config, store)
    await store.set_job_enabled(CULTURE, True)
    assert await _enabled(context, CULTURE) is True
    await store.set_job_enabled(TRENCH, False)
    assert await _enabled(context, TRENCH) is False


def test_only_allowlisted_chats_are_answered(config):
    context = _context(config, None)
    allowed = SimpleNamespace(effective_chat=SimpleNamespace(id=4242))
    stranger = SimpleNamespace(effective_chat=SimpleNamespace(id=9999))
    assert authorised(allowed, context) is True
    assert authorised(stranger, context) is False


def test_a_bot_with_no_allowlist_refuses_to_start(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x")
    monkeypatch.delenv("ALLOWED_CHAT_IDS", raising=False)
    with pytest.raises(RuntimeError, match="ALLOWED_CHAT_IDS"):
        Config().validate()


def test_a_bot_with_no_token_refuses_to_start(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.setenv("ALLOWED_CHAT_IDS", "1")
    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"):
        Config().validate()
