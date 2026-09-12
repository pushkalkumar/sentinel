"""Sim clock (CONTRACT §7.1): seconds since 07:00, play/pause/speed/jump, auto-pause at 20:00."""
from __future__ import annotations

import re
from dataclasses import dataclass

from world import DAY, DAY_END_T, DAY_START_H

SPEEDS = (1, 10, 60, 300)
TICK_S = 30
START_T = 30 * 60  # 07:30, paused, phase calm

JUMP_TARGETS = {
    "calm": 30 * 60,            # 07:30
    "smoke": 6 * 3600 + 55 * 60,  # 13:55
    "fire": 7 * 3600 + 30 * 60,   # 14:30 (+ trigger_fire gym, applied by the caller)
}
_HHMM = re.compile(r"^(\d{1,2}):(\d{2})$")


def format_ts(t: float) -> str:
    """Sim timestamp, §0.4 format, representing the demo's local clock."""
    return f"{DAY}T{format_clock(t, seconds=True)}.000Z"


def format_clock(t: float, seconds: bool = False) -> str:
    total = int(t) + DAY_START_H * 3600
    hh, rem = divmod(total, 3600)
    mm, ss = divmod(rem, 60)
    return f"{hh:02d}:{mm:02d}:{ss:02d}" if seconds else f"{hh:02d}:{mm:02d}"


def parse_jump(target: object) -> float:
    """Accept a phase name, seconds since 07:00, or HH:MM. Raises ValueError otherwise."""
    if isinstance(target, bool):
        raise ValueError("jump target must be calm|smoke|fire, seconds since 07:00, or HH:MM")
    if isinstance(target, (int, float)):
        t = float(target)
    elif isinstance(target, str):
        key = target.strip().lower()
        if key in JUMP_TARGETS:
            t = float(JUMP_TARGETS[key])
        elif key.lstrip("-").isdigit():
            t = float(key)
        else:
            m = _HHMM.match(key)
            if not m:
                raise ValueError("jump target must be calm|smoke|fire, seconds since 07:00, or HH:MM")
            t = float((int(m.group(1)) - DAY_START_H) * 3600 + int(m.group(2)) * 60)
    else:
        raise ValueError("jump target must be calm|smoke|fire, seconds since 07:00, or HH:MM")
    if not 0 <= t <= DAY_END_T:
        raise ValueError("jump target must fall between 07:00 and 20:00")
    return t


def parse_speed(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"speed must be one of {list(SPEEDS)}")
    if float(value) not in SPEEDS:
        raise ValueError(f"speed must be one of {list(SPEEDS)}")
    return int(value)


@dataclass
class SimClock:
    sim_t: float = float(START_T)
    playing: bool = False
    speed: float = 60.0

    def advance(self, wall_dt: float) -> None:
        if not self.playing:
            return
        self.sim_t += wall_dt * self.speed
        if self.sim_t >= DAY_END_T:
            self.sim_t = float(DAY_END_T)
            self.playing = False

    def jump(self, t: float) -> None:
        self.sim_t = float(t)

    def sim_ts(self, t: float | None = None) -> str:
        return format_ts(self.sim_t if t is None else t)

    def sim_clock(self) -> str:
        return format_clock(self.sim_t)

    def next_tick_after(self, t: float) -> float:
        """First tick boundary strictly after t (ticks sit on 30-s multiples)."""
        return (int(t) // TICK_S + 1) * TICK_S
