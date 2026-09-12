"""Feature vector shared by training and live assessment.

Readings are the dicts kept in state.rings (ts, pm25, temp_c, rh, mq2_raw). Windows are in sim seconds, the same
lookbacks the rule engine uses (CONTRACT §5.2) so the model and the rules see the same evidence.
"""
from __future__ import annotations

from functools import lru_cache
from statistics import median

from app.timefmt import parse_iso

FEATURE_NAMES = ("pm25", "pm_rise_5m", "temp_rise_2m", "gas_delta", "ratio_to_neighbour_median",
                 "neighbour_spread", "rh_drop")
PM_LOOKBACK_S = 300
TEMP_LOOKBACK_S = 120
RH_LOOKBACK_S = 120
GAS_BASELINE_FROM_S = 1800
GAS_BASELINE_TO_S = 120
NEIGHBOUR_WINDOW_S = 300
TOLERANCE_S = 45


@lru_cache(maxsize=65536)
def _epoch(iso: str) -> float:
    return parse_iso(iso).timestamp()


def _ts(r: dict) -> float:
    return _epoch(r["ts"])


def _at(history: list[dict], target: float) -> dict | None:
    best = min(history, key=lambda r: abs(_ts(r) - target), default=None)
    if best is None or abs(_ts(best) - target) > TOLERANCE_S:
        older = [r for r in history if _ts(r) < target + TOLERANCE_S]
        return min(older, key=_ts) if older else None
    return best


def _latest_within(history: list[dict], now: float) -> dict | None:
    near = [r for r in history if abs(_ts(r) - now) <= NEIGHBOUR_WINDOW_S]
    return max(near, key=_ts) if near else None


def compute_features(history: list[dict], neighbour_histories: list[list[dict]]) -> dict[str, float]:
    """Features for the newest reading in `history` (oldest first). Missing context degrades to neutral values."""
    if not history:
        return {name: 0.0 for name in FEATURE_NAMES}
    cur = history[-1]
    now = _ts(cur)
    past = [r for r in history[:-1] if _ts(r) < now]
    pm_prior = _at(past, now - PM_LOOKBACK_S)
    temp_prior = _at(past, now - TEMP_LOOKBACK_S)
    rh_prior = _at(past, now - RH_LOOKBACK_S)
    gas_pool = [float(r["mq2_raw"]) for r in past if now - GAS_BASELINE_FROM_S <= _ts(r) <= now - GAS_BASELINE_TO_S]
    if len(gas_pool) < 3:
        gas_pool = [float(r["mq2_raw"]) for r in past] or [float(cur["mq2_raw"])]
    nb = [n for n in (_latest_within(h, now) for h in neighbour_histories) if n is not None]
    nb_pm = [float(n["pm25"]) for n in nb]
    pm25 = float(cur["pm25"])
    nb_median = median(nb_pm) if nb_pm else pm25
    spread = 0.0
    if len(nb_pm) >= 2:
        spread = median(abs(v - nb_median) for v in nb_pm)
    return {
        "pm25": pm25,
        "pm_rise_5m": pm25 - float(pm_prior["pm25"]) if pm_prior else 0.0,
        "temp_rise_2m": float(cur["temp_c"]) - float(temp_prior["temp_c"]) if temp_prior else 0.0,
        "gas_delta": float(cur["mq2_raw"]) - median(gas_pool),
        "ratio_to_neighbour_median": pm25 / max(nb_median, 1.0),
        "neighbour_spread": spread,
        "rh_drop": float(rh_prior["rh"]) - float(cur["rh"]) if rh_prior else 0.0,
    }
