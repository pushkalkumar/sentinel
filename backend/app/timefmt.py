"""Timestamp helpers (CONTRACT §0.3, §0.4). Every timestamp is `YYYY-MM-DDTHH:MM:SS.mmmZ`."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def fmt_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def now_iso() -> str:
    """Wall clock, UTC, millisecond precision, literal Z."""
    return fmt_iso(datetime.now(timezone.utc))


def parse_iso(iso: str) -> datetime:
    """Parse a contract timestamp into an aware UTC datetime."""
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)


def sim_hhmm(iso: str) -> str:
    """Sim timestamps carry the demo's local clock in their UTC digits: 13:55Z -> "13:55"."""
    return parse_iso(iso).strftime("%H:%M")


def iso_plus(iso: str, seconds: float) -> str:
    return fmt_iso(parse_iso(iso) + timedelta(seconds=seconds))
