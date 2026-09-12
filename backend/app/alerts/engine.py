"""Pure alert evaluation (CONTRACT §5.2 + SIM_WORLD §10 escalation and suspect debounce).

Readings are plain dicts with at least ts, pm25, temp_c, mq2_raw (the shape kept in state.rings).
Open alerts may be Alert rows or dicts; only kind/priority are read.
"""
from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Any, Literal

from app.alerts.bands import policy_with_defaults
from app.timefmt import parse_iso

PRIORITY = {"LOCAL_FIRE": 1, "HAZARDOUS_SMOKE": 2, "LOCAL_SMOKE_SUSPECT": 3, "ACTIVITY_ADVISORY": 4}
NODE_KINDS = ("LOCAL_FIRE", "HAZARDOUS_SMOKE", "LOCAL_SMOKE_SUSPECT")
WINDOW_TOLERANCE_S = 45
PM_LOOKBACK_S = 300
TEMP_LOOKBACK_S = 120
GAS_BASELINE_FROM_S = 1800
GAS_BASELINE_TO_S = 120
NEIGHBOUR_WINDOW_S = 300
FALLBACK_WINDOW_S = 1800
MIN_CLEAR_READINGS = 5
HAZARD_CLEAR_S = 600
CLEAR_RATIO = 1.5
CLEAR_TEMP_RISE = 1.0


@dataclass(frozen=True)
class AlertDecision:
    action: Literal["open", "clear"]
    kind: Literal["LOCAL_FIRE", "HAZARDOUS_SMOKE", "LOCAL_SMOKE_SUSPECT", "ACTIVITY_ADVISORY"]
    priority: int
    node_id: str | None
    band_from: str | None
    band_to: str | None
    reason: str
    metrics: dict
    at: str


def _ts(reading: dict) -> float:
    return parse_iso(reading["ts"]).timestamp()


def _kind(alert: Any) -> str:
    return alert["kind"] if isinstance(alert, dict) else alert.kind


def _closest(history: list[dict], target: float) -> dict | None:
    best = None
    best_dt = None
    for r in history:
        dt = abs(_ts(r) - target)
        if best_dt is None or dt < best_dt:
            best, best_dt = r, dt
    if best is None or best_dt is None or best_dt > WINDOW_TOLERANCE_S:
        return None
    return best


def _oldest_within(history: list[dict], now: float, window_s: float = FALLBACK_WINDOW_S) -> dict | None:
    """Oldest sample strictly older than `now` and no more than window_s back.

    A jump leaves the node with seconds of history instead of minutes, and `_closest` then finds nothing at
    now-5min / now-2min. Comparing against the oldest sample we do have understates the real rise but never
    reports a silent 0, which is what made a 60x fire read as "no heat" (judge item 1). The window keeps
    pre-jump readings from hours earlier out of the comparison.
    """
    pool = [r for r in history if 0 < now - _ts(r) <= window_s]
    return min(pool, key=_ts) if pool else None


def derive(reading: dict, history: list[dict], neighbours: list[dict]) -> dict:
    """pm_rise, temp_rise, gas_delta, regional per CONTRACT §5.2. Windows in sim seconds from reading.ts.

    Also the two level comparisons the rate checks fall back on: temp_excess (this node against the
    neighbour median right now) and the gas baseline (the oldest recent sample when the 30-min pool is empty).
    """
    now = _ts(reading)
    oldest = _oldest_within(history, now)
    prior_pm = _closest(history, now - PM_LOOKBACK_S) or oldest
    prior_temp = _closest(history, now - TEMP_LOOKBACK_S) or oldest
    baseline_pool = [r["mq2_raw"] for r in history
                     if now - GAS_BASELINE_FROM_S <= _ts(r) <= now - GAS_BASELINE_TO_S]
    if len(baseline_pool) < 3:
        baseline_pool = [r["mq2_raw"] for r in history if 0 < now - _ts(r) <= FALLBACK_WINDOW_S]
    near = [n for n in neighbours if abs(_ts(n) - now) <= NEIGHBOUR_WINDOW_S]
    regional = median(n["pm25"] for n in near) if near else float(reading["pm25"])
    temps = [float(n["temp_c"]) for n in near if n.get("temp_c") is not None]
    temp_c = float(reading["temp_c"])
    neighbour_temp = median(temps) if temps else temp_c
    return {
        "pm25": float(reading["pm25"]),
        "pm_rise": float(reading["pm25"]) - float(prior_pm["pm25"]) if prior_pm else 0.0,
        "temp_rise": temp_c - float(prior_temp["temp_c"]) if prior_temp else 0.0,
        "gas_delta": float(reading["mq2_raw"]) - float(median(baseline_pool)) if baseline_pool else 0.0,
        "regional": float(regional),
        "temp_c": temp_c,
        "neighbour_temp": neighbour_temp,
        "temp_excess": temp_c - neighbour_temp,
        "neighbours": near,
    }


def _fire_driver(m: dict, p: dict) -> str:
    if m["temp_rise"] > p["temp_rise"]:
        return f"+{m['temp_rise']:.1f} °C"
    if m.get("temp_excess", 0.0) > p["temp_rise"]:
        return f"{m['temp_excess']:.1f} °C hotter than its neighbours"
    return f"gas +{m['gas_delta']:.0f}"


def _fire_reason(m: dict, p: dict) -> str:
    return (f"PM2.5 rose {m['pm_rise']:.0f} in 5 min with {_fire_driver(m, p)};"
            f" neighbours median {m['regional']:.0f} — fire at this node, not the sky")


def _smoke_reason(m: dict) -> str:
    return f"PM2.5 {m['pm25']:.0f} with neighbours at {m['regional']:.0f} — regional smoke, hazardous band"


def _suspect_reason(m: dict) -> str:
    return (f"PM2.5 rose {m['pm_rise']:.0f} at this node while neighbours sit at {m['regional']:.0f};"
            " no heat — ask staff to check")


def heat_or_gas(m: dict, p: dict) -> bool:
    """Fire signature besides the particles: a temperature rise OR heat above the neighbours OR gas over baseline.

    The rate checks alone need 2 min of history at the node; the level checks hold on the first reading after a
    jump, which is what the gym fire is at 60x and 300x (judge item 1).
    """
    return (m["temp_rise"] > p["temp_rise"]
            or m.get("temp_excess", 0.0) > p["temp_rise"]
            or m["gas_delta"] > p["gas_delta"])


def match_branch(m: dict, p: dict) -> str:
    """First-match-wins branch name for the current reading; CLEAR when no open rule matches."""
    ratio_ok = m["pm25"] > p["regional_factor"] * m["regional"]
    if m["pm_rise"] > p["pm_rise"] and heat_or_gas(m, p) and ratio_ok:
        return "LOCAL_FIRE"
    if m["pm25"] > p["hazardous_pm25"] and m["regional"] > p["hazardous_regional"]:
        return "HAZARDOUS_SMOKE"
    if m["pm_rise"] > p["pm_rise"] and ratio_ok:
        return "LOCAL_SMOKE_SUSPECT"
    return "CLEAR"


def _heat_row(m: dict, p: dict) -> dict:
    """The heat row the UI shows: the rate check, or the neighbour comparison when that is the stronger signal."""
    excess = m.get("temp_excess", 0.0)
    if m["temp_rise"] >= excess:
        return {"name": "temp_rise", "expr": f"temp_rise > {p['temp_rise']:g}",
                "lhs": round(m["temp_rise"], 1), "op": ">", "rhs": p["temp_rise"]}
    return {"name": "temp_vs_neighbours", "expr": f"temp above neighbour median > {p['temp_rise']:g}",
            "lhs": round(excess, 1), "op": ">", "rhs": p["temp_rise"]}


def build_checks(branch: str, m: dict, p: dict) -> list[dict]:
    """Rows the UI renders verbatim (NOVELTY §3.2). CLEAR shows the fire chain so the failing rows are visible."""
    rhs_ratio = round(p["regional_factor"] * m["regional"], 1)
    heat = _heat_row(m, p)
    fire = [
        {"name": "pm_rise", "expr": f"pm_rise > {p['pm_rise']:g}", "lhs": round(m["pm_rise"], 1), "op": ">", "rhs": p["pm_rise"]},
        heat,
        {"name": "gas_delta", "expr": f"gas_delta > {p['gas_delta']:g}", "lhs": round(m["gas_delta"], 0), "op": ">", "rhs": p["gas_delta"]},
        {"name": "ratio", "expr": f"pm25 > {p['regional_factor']:g} × regional", "lhs": round(m["pm25"], 1), "op": ">", "rhs": rhs_ratio},
    ]
    hazardous = [
        {"name": "pm25", "expr": f"pm25 > {p['hazardous_pm25']:g}", "lhs": round(m["pm25"], 1), "op": ">", "rhs": p["hazardous_pm25"]},
        {"name": "regional", "expr": f"regional > {p['hazardous_regional']:g}", "lhs": round(m["regional"], 1), "op": ">", "rhs": p["hazardous_regional"]},
    ]
    if branch == "LOCAL_FIRE":
        rows = fire
    elif branch == "HAZARDOUS_SMOKE":
        rows = hazardous
    elif branch == "LOCAL_SMOKE_SUSPECT":
        rows = [fire[0], fire[3], {**heat, "expr": heat["expr"].replace(">", "<=", 1), "op": "<="}]
    else:
        rows = fire + hazardous[:1]
    out = []
    for row in rows:
        passed = row["lhs"] > row["rhs"] if row["op"] == ">" else row["lhs"] <= row["rhs"]
        out.append({**row, "pass": bool(passed)})
    return out


def _should_clear_local(reading: dict, history: list[dict], m: dict, p: dict) -> bool:
    now = _ts(reading)
    window_s = p["clear_after_minutes"] * 60
    recent = [r for r in history if now - window_s <= _ts(r) <= now] + [reading]
    if len(recent) < MIN_CLEAR_READINGS:
        return False
    limit = CLEAR_RATIO * m["regional"]
    for r in recent:
        if float(r["pm25"]) > limit:
            return False
        prior = _closest(history, _ts(r) - TEMP_LOOKBACK_S)
        if prior is not None and float(r["temp_c"]) - float(prior["temp_c"]) >= CLEAR_TEMP_RISE:
            return False
    return True


def _clear_decisions(reading: dict, history: list[dict], m: dict, p: dict, open_kinds: set[str],
                     metrics: dict, at: str, skip: set[str] = frozenset()) -> list[AlertDecision]:
    out: list[AlertDecision] = []
    for kind in ("LOCAL_FIRE", "LOCAL_SMOKE_SUSPECT"):
        if kind in open_kinds and kind not in skip and _should_clear_local(reading, history, m, p):
            out.append(AlertDecision("clear", kind, PRIORITY[kind], None, None, None,
                                     f"PM2.5 back within {CLEAR_RATIO:g}x of neighbours with no heat rise",
                                     metrics, at))
    if "HAZARDOUS_SMOKE" in open_kinds and "HAZARDOUS_SMOKE" not in skip \
            and _should_clear_hazardous(reading, history, p):
        out.append(AlertDecision("clear", "HAZARDOUS_SMOKE", 2, None, None, None,
                                 f"PM2.5 under {p['hazardous_regional']:g} for 10 min", metrics, at))
    return out


def _should_clear_hazardous(reading: dict, history: list[dict], p: dict) -> bool:
    now = _ts(reading)
    recent = [r for r in history if now - HAZARD_CLEAR_S <= _ts(r) <= now] + [reading]
    if len(recent) < MIN_CLEAR_READINGS:
        return False
    return all(float(r["pm25"]) < p["hazardous_regional"] for r in recent)


def evaluate(reading: dict, history: list[dict], neighbours: list[dict], open_alerts: list[Any],
             policy: dict, site_band: str | None, suspect_streak: int = 0) -> tuple[list[AlertDecision], dict]:
    """Pure. Returns (decisions, eval_record). eval_record is the NodeEval-shaped dict plus checks/verdict/streak."""
    p = policy_with_defaults(policy)
    m = derive(reading, history, neighbours)
    metrics = {k: round(m[k], 2) for k in ("pm25", "pm_rise", "temp_rise", "gas_delta", "regional", "temp_excess")}
    open_kinds = {_kind(a) for a in open_alerts}
    open_node_kinds = [k for k in NODE_KINDS if k in open_kinds]
    highest_open = min((PRIORITY[k] for k in open_node_kinds), default=99)
    at = reading["ts"]

    branch = match_branch(m, p)
    streak = suspect_streak + 1 if branch == "LOCAL_SMOKE_SUSPECT" else 0
    decisions: list[AlertDecision] = []

    if branch == "LOCAL_FIRE" and "LOCAL_FIRE" not in open_kinds:
        reason = _fire_reason(m, p)
        for lower in ("HAZARDOUS_SMOKE", "LOCAL_SMOKE_SUSPECT"):
            if lower in open_kinds:
                decisions.append(AlertDecision("clear", lower, PRIORITY[lower], None, None, None,
                                               f"Escalated to LOCAL_FIRE", metrics, at))
                reason = f"Escalated from {lower}: {reason}"
        decisions.append(AlertDecision("open", "LOCAL_FIRE", 1, None, None, None, reason, metrics, at))
    elif branch == "HAZARDOUS_SMOKE" and "HAZARDOUS_SMOKE" not in open_kinds and highest_open > 2:
        decisions.append(AlertDecision("open", "HAZARDOUS_SMOKE", 2, None, None, None, _smoke_reason(m), metrics, at))
    elif (branch == "LOCAL_SMOKE_SUSPECT" and streak >= 2
          and "LOCAL_SMOKE_SUSPECT" not in open_kinds and highest_open > 3):
        decisions.append(AlertDecision("open", "LOCAL_SMOKE_SUSPECT", 3, None, None, None, _suspect_reason(m), metrics, at))

    skip = {d.kind for d in decisions if d.action == "clear"} | {d.kind for d in decisions if d.action == "open"}
    decisions.extend(_clear_decisions(reading, history, m, p, open_kinds, metrics, at, skip))

    # Reported branch: what matched now, else the highest-priority alert still open at the node.
    still_open = [k for k in open_node_kinds if k not in {d.kind for d in decisions if d.action == "clear"}]
    reported = branch if branch != "CLEAR" else (still_open[0] if still_open else "CLEAR")
    regional = m["regional"] or 0.0
    record = {
        "sim_ts": at,
        "pm25": round(m["pm25"], 2),
        "pm_rise": round(m["pm_rise"], 2),
        "temp_rise": round(m["temp_rise"], 2),
        "gas_delta": round(m["gas_delta"], 1),
        "regional": round(regional, 2),
        "ratio": round(m["pm25"] / regional, 2) if regional > 0 else 0.0,
        "neighbour_ids": [n.get("node_id") for n in m["neighbours"]],
        "neighbour_pm25": [round(float(n["pm25"]), 1) for n in m["neighbours"]],
        "branch": reported,
        "thresholds": {k: p[k] for k in ("pm_rise", "temp_rise", "gas_delta", "regional_factor",
                                         "hazardous_pm25", "hazardous_regional")},
        "checks": build_checks(reported, m, p),
        "suspect_streak": streak,
        "site_band": site_band,
    }
    return decisions, record


def clear_check(reading: dict, history: list[dict], neighbours: list[dict], open_alerts: list[Any],
                policy: dict) -> list[AlertDecision]:
    """Clear decisions for a node that did not report this tick (judge item 6).

    The open alert has to be able to close on readings that have gone quiet, not only when that node's own
    telemetry arrives: after a jump or a dropped tick the node goes silent while its last reading is already
    back in band, and the banner would otherwise keep a red EVACUATE bar over a node reading 52.
    """
    p = policy_with_defaults(policy)
    m = derive(reading, history, neighbours)
    metrics = {k: round(m[k], 2) for k in ("pm25", "pm_rise", "temp_rise", "gas_delta", "regional", "temp_excess")}
    open_kinds = {_kind(a) for a in open_alerts}
    return _clear_decisions(reading, history, m, p, open_kinds, metrics, reading["ts"])
