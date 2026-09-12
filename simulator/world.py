"""Scripted day and per-node readings (CONTRACT §7.2).

Pure functions. Every reading is deterministic given (seed, node, sim_t, overrides):
noise is hashed from (seed, node, channel, 10-second bucket), never stepped, so two
processes with the same seed produce identical readings (technique from SIM_WORLD §8).
Sim time `t` is seconds since 07:00 on the demo day.
"""
from __future__ import annotations

import json
import math
import random
import zlib
from dataclasses import dataclass, field
from pathlib import Path

DAY = "2026-09-12"
DAY_START_H = 7
DAY_END_T = 13 * 3600  # 20:00

FIRE_RAMP_S = 240          # ignition to full fire: 8 ticks of 30 s, so the ramp is visible at every speed
FIRE_SMOULDER_S = 180      # slow PM creep first (SIM_WORLD §8 shape), then flaming growth over the last 60 s
FIRE_SMOULDER_LEVEL = 0.12  # fraction of the full fire reached when the smoulder turns into flame
SMOKE_RAMP_S = 120
CLEAR_DECAY_S = 120
SMOKE_TARGET_PM = 240.0
FIRE_PM = 180.0
FIRE_TEMP = 6.0
FIRE_MQ2 = 300.0
RH_COLLAPSE_PER_DEG = 0.058  # SIM_WORLD §6.3: absolute humidity held constant while the room heats

# Regional outdoor PM2.5 R(t), piecewise linear in clock hours.
_R_POINTS = ((7.0, 6.0), (12.5, 6.0), (13.0, 20.0), (14.0, 75.0), (15.0, 140.0),
             (17.0, 140.0), (19.0, 60.0), (20.0, 40.0))


@dataclass(frozen=True)
class NodeInfo:
    id: str
    label: str
    site_id: int
    site_kind: str
    indoor: bool
    is_gateway: bool
    neighbours: tuple[str, ...]
    index: int

    @property
    def is_warehouse(self) -> bool:
        return self.site_kind == "floorplan"


def load_nodes(topology_path: Path) -> list[NodeInfo]:
    topology = json.loads(topology_path.read_text())
    nodes: list[NodeInfo] = []
    for site in topology["sites"]:
        for raw in site["nodes"]:
            if raw.get("hardware"):   # real boards (hardware/xenon) report through the serial bridge, not here
                continue
            nodes.append(NodeInfo(
                id=raw["id"], label=raw["label"], site_id=site["id"], site_kind=site["kind"],
                indoor=bool(raw["indoor"]), is_gateway=bool(raw["is_gateway"]),
                neighbours=tuple(raw["neighbours"]), index=len(nodes),
            ))
    return nodes


# --------------------------------------------------------------------------- #
# Deterministic noise (SIM_WORLD §8 technique)
# --------------------------------------------------------------------------- #
def _rng(seed: int, *keys: object) -> random.Random:
    h = zlib.crc32("|".join(map(str, keys)).encode()) ^ ((seed * 0x9E3779B1) & 0xFFFFFFFF)
    return random.Random(h)


def white(seed: int, node_id: str, channel: str, t: float, sigma: float) -> float:
    bucket = int(round(t / 10.0))
    return _rng(seed, node_id, channel, bucket).gauss(0.0, sigma)


def node_bias(seed: int, node_id: str, channel: str, lo: float, hi: float) -> float:
    return _rng(seed, node_id, channel, "bias").uniform(lo, hi)


# --------------------------------------------------------------------------- #
# Scripted sky
# --------------------------------------------------------------------------- #
def clock_hours(t: float) -> float:
    return DAY_START_H + t / 3600.0


def regional_pm25(t: float) -> float:
    h = min(max(clock_hours(t), _R_POINTS[0][0]), _R_POINTS[-1][0])
    value = _R_POINTS[-1][1]
    for (h0, v0), (h1, v1) in zip(_R_POINTS, _R_POINTS[1:]):
        if h0 <= h <= h1:
            value = v0 + (v1 - v0) * (h - h0) / (h1 - h0)
            break
    if 15.0 <= h <= 17.0:
        value += 8.0 * math.sin(2 * math.pi * (h - 15.0) * 60.0 / 40.0)
    return value


def scheduled_phase(t: float) -> str:
    h = clock_hours(t)
    if h < 13.0:
        return "calm"
    if h < 17.0:
        return "smoke"
    return "clearing"


def outdoor_temp(t: float) -> float:
    h = min(max(clock_hours(t), 7.0), 20.0)
    return 12.0 + 12.0 * math.sin(math.pi * (h - 7.0) / 13.0)


# --------------------------------------------------------------------------- #
# Operator overrides
# --------------------------------------------------------------------------- #
def _clamp01(x: float) -> float:
    return min(1.0, max(0.0, x))


def fire_curve(age_s: float) -> float:
    """Fraction (0..1) of the full fire `age_s` sim seconds after ignition: a smoulder, then flaming growth.

    The engine reads rates, not levels: temp_rise against the reading 120 s back, pm_rise against 300 s back
    (CONTRACT §5.2). The smoulder stays under the pm_rise threshold (0.12 x 180 = 22 < 40) and the growth leg is
    shorter than the temperature lookback, so the first rule a burning node trips is LOCAL_FIRE, never
    LOCAL_SMOKE_SUSPECT, and it trips at 60x or 300x just as it does at 1x because every leg spans whole ticks.
    """
    if age_s <= 0.0:
        return 0.0
    if age_s < FIRE_SMOULDER_S:
        return FIRE_SMOULDER_LEVEL * age_s / FIRE_SMOULDER_S
    growth = (age_s - FIRE_SMOULDER_S) / (FIRE_RAMP_S - FIRE_SMOULDER_S)
    return FIRE_SMOULDER_LEVEL + (1.0 - FIRE_SMOULDER_LEVEL) * _clamp01(growth)


@dataclass
class Overrides:
    fire: dict[str, float] = field(default_factory=dict)  # node_id -> sim t0
    smoke_t0: float | None = None
    clear_t: float | None = None

    def _decay(self, t: float) -> float:
        if self.clear_t is None:
            return 1.0
        return _clamp01(1.0 - (t - self.clear_t) / CLEAR_DECAY_S)

    def prune(self, t: float) -> None:
        """Drop overrides once a clear() has fully decayed."""
        if self.clear_t is not None and t - self.clear_t >= CLEAR_DECAY_S:
            self.reset()

    def reset(self) -> None:
        self.fire.clear()
        self.smoke_t0 = None
        self.clear_t = None

    def _cancel_pending_clear(self) -> None:
        if self.clear_t is not None:
            self.reset()

    def trigger_fire(self, node_id: str, t: float) -> None:
        self._cancel_pending_clear()
        self.fire[node_id] = t

    def trigger_smoke(self, t: float) -> None:
        self._cancel_pending_clear()
        if self.smoke_t0 is None:
            self.smoke_t0 = t

    def clear(self, t: float) -> None:
        if (self.fire or self.smoke_t0 is not None) and self.clear_t is None:
            self.clear_t = t

    def fire_ramp(self, node_id: str, t: float) -> float:
        t0 = self.fire.get(node_id)
        if t0 is None:
            return 0.0
        return fire_curve(t - t0) * self._decay(t)

    def smoke_boost(self, t: float, regional: float) -> float:
        if self.smoke_t0 is None:
            return 0.0
        return max(0.0, SMOKE_TARGET_PM - regional) * _clamp01((t - self.smoke_t0) / SMOKE_RAMP_S) * self._decay(t)

    @property
    def fire_nodes(self) -> list[str]:
        return sorted(self.fire)

    @property
    def smoke_active(self) -> bool:
        return self.smoke_t0 is not None


def phase(t: float, ov: Overrides) -> str:
    return "fire" if ov.fire else scheduled_phase(t)


# --------------------------------------------------------------------------- #
# Per-node reading
# --------------------------------------------------------------------------- #
def reading(node: NodeInfo, t: float, ov: Overrides, seed: int, ts: str) -> dict:
    h = clock_hours(t)
    regional = regional_pm25(t)
    if not node.indoor:
        # Field sits in the open next to the highway; it reads worst on smoke days (SIM_WORLD §6).
        factor = 1.08 if node.id == "field" else 1.0
    elif node.is_warehouse:
        factor = 0.5
    else:
        factor = 0.7

    b = node_bias(seed, node.id, "pm", -3.0, 3.0)
    b_mq2 = node_bias(seed, node.id, "mq2", -10.0, 10.0)
    rssi_base = -40.0 if node.is_gateway else node_bias(seed, node.id, "rssi", -92.0, -58.0)

    ramp = ov.fire_ramp(node.id, t)
    fire_pm, fire_temp, fire_mq2 = FIRE_PM * ramp, FIRE_TEMP * ramp, FIRE_MQ2 * ramp
    boost = ov.smoke_boost(t, regional)

    pm25 = max(0.0, regional * factor + b + white(seed, node.id, "pm25", t, 1.5)) + fire_pm + boost * factor
    pm1 = max(0.0, 0.62 * pm25 + white(seed, node.id, "pm1", t, 0.5))
    pm10 = max(0.0, 1.30 * pm25 + white(seed, node.id, "pm10", t, 1.0))

    t_out = outdoor_temp(t)
    temp_c = (t_out if not node.indoor else 20.0 + 0.25 * (t_out - 20.0)) \
        + white(seed, node.id, "temp", t, 0.15) + fire_temp

    rh = (max(35.0, 75.0 - 2.5 * (h - 7.0)) if not node.indoor else 45.0) + white(seed, node.id, "rh", t, 0.8)
    rh *= math.exp(-RH_COLLAPSE_PER_DEG * fire_temp)
    rh = min(100.0, max(1.0, rh))

    mq2_raw = int(round(180.0 + b_mq2 + 0.3 * pm25 + white(seed, node.id, "mq2", t, 4.0) + fire_mq2))
    rssi = int(round(rssi_base + white(seed, node.id, "rssi", t, 2.0)))
    battery = 100.0 if node.indoor else round(92.0 - 0.4 * max(0.0, h - 16.0), 1)

    return {
        "node_id": node.id,
        "ts": ts,
        "pm1": round(pm1, 1),
        "pm25": round(pm25, 1),
        "pm10": round(pm10, 1),
        "temp_c": round(temp_c, 1),
        "rh": round(rh, 1),
        "mq2_raw": max(0, mq2_raw),
        "rssi": rssi,
        "battery_pct": battery,
    }
