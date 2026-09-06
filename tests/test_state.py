from __future__ import annotations

import pytest

from sri_wagmi.state import Store


@pytest.mark.asyncio
async def test_calls_are_suppressed_inside_the_window(tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    await store.record_calls("trench", ["MINT_A", "MINT_B"])
    assert await store.recently_called("trench", 24.0) == {"MINT_A", "MINT_B"}


@pytest.mark.asyncio
async def test_suppression_is_per_scan(tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    await store.record_calls("trench", ["MINT_A"])
    assert await store.recently_called("secondary", 24.0) == set()


@pytest.mark.asyncio
async def test_old_calls_fall_out_of_the_window(tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    await store.record_calls("trench", ["MINT_A"])
    assert await store.recently_called("trench", 0.0) == set()


@pytest.mark.asyncio
async def test_recording_the_same_mint_twice_is_fine(tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    await store.record_calls("trench", ["MINT_A"])
    await store.record_calls("trench", ["MINT_A"])
    assert await store.recently_called("trench", 24.0) == {"MINT_A"}


@pytest.mark.asyncio
async def test_job_state_round_trips(tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    assert await store.get_job_enabled("culture") is None
    await store.set_job_enabled("culture", True)
    assert await store.get_job_enabled("culture") is True
    await store.set_job_enabled("culture", False)
    assert await store.get_job_enabled("culture") is False


@pytest.mark.asyncio
async def test_prune_drops_records_past_the_cutoff(tmp_path):
    store = Store(str(tmp_path / "s.sqlite3"))
    await store.init()
    await store.record_calls("trench", ["MINT_A"])
    assert await store.prune(older_than_hours=0.0) == 1
    assert await store.recently_called("trench", 24.0) == set()
