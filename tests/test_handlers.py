"""Handler wiring, driven with stand-in Telegram objects.

These prove the paths a user actually takes: a command from an allowed chat,
the same command from a stranger, and a bare contract pasted into the chat.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from sri_wagmi.bot import handlers
from sri_wagmi.config import Config
from sri_wagmi.models import Token

MINT = "8x9c1v9BJmXsvKf2Xa1o8N2gT7pQwR3sMzYbEd4Hn5Ka"


class FakeMessage:
    def __init__(self, text: str = "") -> None:
        self.text = text
        self.reply_to_message = None
        self.replies: list[str] = []

    async def reply_text(self, text, **_kwargs):
        self.replies.append(text)


class FakeScanner:
    def __init__(self) -> None:
        self.checked: list[str] = []

    async def check(self, raw: str):
        self.checked.append(raw)
        return Token(mint=MINT, symbol="GOOD", name="Good Coin"), ""


def _update(text: str = "", chat_id: int = 4242):
    message = FakeMessage(text)
    return SimpleNamespace(
        effective_chat=SimpleNamespace(id=chat_id),
        effective_message=message,
    ), message


def _context(scanner: FakeScanner, config: Config, args: list[str] | None = None):
    return SimpleNamespace(
        args=args,
        application=SimpleNamespace(bot_data={"config": config, "scanner": scanner, "last_rejections": {}}),
    )


@pytest.fixture
def config(monkeypatch) -> Config:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x")
    monkeypatch.setenv("ALLOWED_CHAT_IDS", "4242")
    return Config()


@pytest.mark.asyncio
async def test_check_command_reports_the_token(config):
    scanner = FakeScanner()
    update, message = _update()
    await handlers.check(update, _context(scanner, config, [MINT]))
    assert scanner.checked == [MINT]
    assert any(MINT in reply for reply in message.replies)


@pytest.mark.asyncio
async def test_check_without_an_argument_asks_for_one(config):
    scanner = FakeScanner()
    update, message = _update()
    await handlers.check(update, _context(scanner, config, []))
    assert scanner.checked == []
    assert "Paste a contract" in message.replies[0]


@pytest.mark.asyncio
async def test_check_falls_back_to_the_replied_to_message(config):
    scanner = FakeScanner()
    update, message = _update()
    message.reply_to_message = FakeMessage(MINT)
    await handlers.check(update, _context(scanner, config, []))
    assert scanner.checked == [MINT]


@pytest.mark.asyncio
async def test_a_stranger_gets_no_answer(config):
    scanner = FakeScanner()
    update, message = _update(chat_id=9999)
    await handlers.check(update, _context(scanner, config, [MINT]))
    assert scanner.checked == []
    assert message.replies == []


@pytest.mark.asyncio
async def test_a_pasted_contract_is_checked(config):
    scanner = FakeScanner()
    update, _message = _update(f"wdyt {MINT}")
    await handlers.on_text(update, _context(scanner, config))
    assert scanner.checked == [MINT]


@pytest.mark.asyncio
async def test_ordinary_chatter_is_ignored(config):
    """Only an address triggers a check. The bot does not answer conversation."""
    scanner = FakeScanner()
    update, message = _update("gm is it over")
    await handlers.on_text(update, _context(scanner, config))
    assert scanner.checked == []
    assert message.replies == []


@pytest.mark.asyncio
async def test_help_lists_the_limits_as_well_as_the_commands(config):
    update, message = _update()
    await handlers.start(update, _context(FakeScanner(), config))
    text = message.replies[0]
    assert "/check" in text
    assert "GMGN" in text
    assert "Max 3 names or silence" in text


@pytest.mark.asyncio
async def test_thresholds_prints_the_live_numbers(config):
    update, message = _update()
    await handlers.thresholds(update, _context(FakeScanner(), config))
    text = message.replies[0]
    assert "bonded 30-70%" in text
    assert "$2m-$25m" in text
