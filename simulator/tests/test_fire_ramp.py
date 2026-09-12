"""Fire ramp shape and the engine's view of it (judge review item 1).

Run: backend/.venv/bin/pytest -q simulator/tests
"""
import pytest

from clock import TICK_S, format_ts
from world import (FIRE_MQ2, FIRE_RAMP_S, FIRE_SMOULDER_LEVEL, FIRE_SMOULDER_S, FIRE_TEMP, Overrides, fire_curve,
                   load_nodes, reading)
from app.alerts.bands import policy_with_defaults
from app.alerts.engine import evaluate

from conftest import ROOT

NODES = {n.id: n for n in load_nodes(ROOT / "shared" / "topology.json")}
GYM = NODES["gym"]
NEIGHBOURS = [NODES[n] for n in GYM.neighbours]
POLICY = policy_with_defaults({})
SMOKE_T = 6 * 3600 + 55 * 60
FIRE_T = 7 * 3600 + 30 * 60


def test_ramp_spans_at_least_six_ticks_and_is_smoulder_then_growth():
    assert FIRE_RAMP_S >= 6 * TICK_S
    assert fire_curve(0) == 0.0 and fire_curve(FIRE_RAMP_S) == 1.0 and fire_curve(FIRE_RAMP_S + 999) == 1.0
    assert fire_curve(FIRE_SMOULDER_S) == pytest.approx(FIRE_SMOULDER_LEVEL)
    smoulder_rate = fire_curve(FIRE_SMOULDER_S) / FIRE_SMOULDER_S
    growth_rate = (1.0 - FIRE_SMOULDER_LEVEL) / (FIRE_RAMP_S - FIRE_SMOULDER_S)
    assert growth_rate > 5 * smoulder_rate
    steps = [fire_curve(t) for t in range(0, FIRE_RAMP_S + 1)]
    assert all(b >= a for a, b in zip(steps, steps[1:]))


def test_full_fire_adds_six_degrees_and_three_hundred_mq2():
    ov = Overrides()
    t0 = 8 * 3600
    ov.trigger_fire("gym", t0)
    t = t0 + FIRE_RAMP_S
    burning = reading(GYM, t, ov, 42, format_ts(t))
    quiet = reading(GYM, t, Overrides(), 42, format_ts(t))
    assert burning["temp_c"] - quiet["temp_c"] >= FIRE_TEMP - 0.05
    assert burning["mq2_raw"] - quiet["mq2_raw"] >= FIRE_MQ2


def test_clear_decays_to_zero_then_prunes():
    ov = Overrides()
    ov.trigger_fire("gym", 0.0)
    ov.clear(FIRE_RAMP_S + 600)
    t_clear = FIRE_RAMP_S + 600
    assert ov.fire_ramp("gym", t_clear) == 1.0
    assert 0.0 < ov.fire_ramp("gym", t_clear + 60) < 1.0
    assert ov.fire_ramp("gym", t_clear + 120) == 0.0
    ov.prune(t_clear + 120)
    assert ov.fire_nodes == []


def _first_open_alert(jump_t: float, fire_after_s: float, seed: int = 42) -> tuple[str, float]:
    """Replay simulator ticks through the backend engine; return (kind, sim seconds after ignition) of the first alert."""
    ov = Overrides()
    t0 = jump_t + fire_after_s
    history: list[dict] = []
    open_kinds: list[str] = []
    streak = 0
    t = float(jump_t)
    while t <= t0 + FIRE_RAMP_S + 600:
        if t >= t0 and not ov.fire:
            ov.trigger_fire("gym", t0)
        ts = format_ts(t)
        gym = reading(GYM, t, ov, seed, ts)
        near = [reading(n, t, ov, seed, ts) for n in NEIGHBOURS]
        decisions, record = evaluate(gym, history, near, [{"kind": k} for k in open_kinds], POLICY, None, streak)
        streak = record.get("suspect_streak", 0)
        for d in decisions:
            if d.action == "open":
                return d.kind, t - t0
        history.append(gym)
        t += TICK_S
    return "NONE", float("inf")


@pytest.mark.parametrize("jump_t,fire_after_s", [
    (SMOKE_T, 0), (SMOKE_T, 300), (FIRE_T, 0), (30 * 60, 300), (8 * 3600, 300),
])
@pytest.mark.parametrize("offset", [0, 7, 15, 22, 29])
def test_engine_opens_local_fire_first_at_any_tick_phase(jump_t, fire_after_s, offset):
    """The judge saw LOCAL_SMOKE_SUSPECT (temp_rise 0) when a 60 s ramp finished before the engine had history.
    Whatever the trigger's phase against the 30 s tick grid, the first alert must be LOCAL_FIRE within 10 ticks."""
    kind, after = _first_open_alert(jump_t, fire_after_s + offset)
    assert kind == "LOCAL_FIRE", (kind, after)
    assert after <= 10 * TICK_S
