"""Trust score (CONTRACT §4.2), incident codes (§4.4) and haversine. Pure functions; score_incident never raises."""
from __future__ import annotations

import math
import secrets
import statistics
from typing import Any

from app.timefmt import parse_iso

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # 31 symbols, no 0/O/1/I/L

SENSOR_TYPES = {"fire", "trapped", "medical", "other"}
ROLE_TYPES = {"teacher", "admin", "responder"}

PM25_SENSOR_THRESHOLD = 55.0
TEMP_RISE_THRESHOLD = 3.0
MQ2_DELTA_THRESHOLD = 150
GPS_NEAR_M = 100.0
GPS_FAR_M = 500.0


def new_code(existing_recent: set[str]) -> str:
    while True:
        code = "SN-" + "".join(secrets.choice(ALPHABET) for _ in range(4))
        if code not in existing_recent:
            return code


def normalise_code(raw: str) -> str:
    """Uppercase, strip whitespace, prepend SN- when missing. No glyph mapping (§4.4)."""
    cleaned = "".join(raw.split()).upper()
    if cleaned.startswith("SN-"):
        return cleaned
    if cleaned.startswith("SN") and len(cleaned) == 6:
        return "SN-" + cleaned[2:]
    return "SN-" + cleaned


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _get(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _ts_seconds(obj: Any) -> float | None:
    ts = _get(obj, "ts")
    if not ts:
        return None
    try:
        return parse_iso(str(ts)).timestamp()
    except (ValueError, TypeError):
        return None


def temp_rise_2min(latest: Any, history: list[Any]) -> float | None:
    """latest.temp_c minus temp at ts-120 s (±45 s); None when no such sample."""
    t0 = _ts_seconds(latest)
    latest_temp = _get(latest, "temp_c")
    if t0 is None or latest_temp is None:
        return None
    target = t0 - 120.0
    best = None
    best_dist = 45.0
    for r in history:
        t = _ts_seconds(r)
        if t is None:
            continue
        dist = abs(t - target)
        if dist <= best_dist:
            best, best_dist = r, dist
    if best is None:
        return None
    temp = _get(best, "temp_c")
    if temp is None:
        return None
    return float(latest_temp) - float(temp)


def mq2_delta(latest: Any, history: list[Any]) -> float | None:
    """latest.mq2_raw minus median mq2 over [ts-30 min, ts-2 min]; None when the window is empty."""
    t0 = _ts_seconds(latest)
    latest_mq2 = _get(latest, "mq2_raw")
    if t0 is None or latest_mq2 is None:
        return None
    lo, hi = t0 - 1800.0, t0 - 120.0
    values = []
    for r in history:
        t = _ts_seconds(r)
        v = _get(r, "mq2_raw")
        if t is None or v is None:
            continue
        if lo <= t <= hi:
            values.append(float(v))
    if not values:
        return None
    return float(latest_mq2) - statistics.median(values)


def _sensor_layer(node: Any, latest: Any, history: list[Any], open_alerts: list[Any],
                  incident_type: str) -> tuple[int, str]:
    node_id = _get(node, "id", "node")
    if node is None:
        return 0, "No node stamp, sensors not consulted"
    if incident_type not in SENSOR_TYPES:
        return 0, f"Sensor check does not apply to '{incident_type}' reports"
    if latest is None:
        return 0, f"{node_id}: no readings yet"

    pm25 = _get(latest, "pm25")
    rise = temp_rise_2min(latest, history)
    gas = mq2_delta(latest, history)
    alert_hit = [a for a in open_alerts if (_get(a, "priority") or 99) <= 3 and _get(a, "cleared_at") is None]

    hits = []
    if pm25 is not None and float(pm25) > PM25_SENSOR_THRESHOLD:
        hits.append(f"PM2.5 {float(pm25):.0f} (>{PM25_SENSOR_THRESHOLD:.0f})")
    if rise is not None and rise > TEMP_RISE_THRESHOLD:
        hits.append(f"temp +{rise:.1f} °C/2 min")
    if gas is not None and gas > MQ2_DELTA_THRESHOLD:
        hits.append(f"gas +{gas:.0f} over baseline")
    if alert_hit:
        hits.append(f"{_get(alert_hit[0], 'kind', 'alert')} open")

    if hits:
        return 30, f"{node_id}: " + ", ".join(hits)
    pm_txt = f"PM2.5 {float(pm25):.0f}" if pm25 is not None else "PM2.5 n/a"
    return 0, f"{node_id}: {pm_txt}, no temperature or gas rise, no open alert"


def score_incident(*, node: Any, latest: Any, history: list[Any],
                   open_alerts: list[Any], crowd_devices: int, reporter_role: str | None,
                   lat: float | None, lng: float | None, false_flags: int,
                   incident_type: str) -> tuple[int, str, list[dict]]:
    """Returns (score 0..100, label, breakdown). Never raises."""
    try:
        return _score(node=node, latest=latest, history=history or [], open_alerts=open_alerts or [],
                      crowd_devices=int(crowd_devices or 0), reporter_role=reporter_role,
                      lat=lat, lng=lng, false_flags=int(false_flags or 0), incident_type=str(incident_type))
    except Exception:  # noqa: BLE001 - trust must never block an incident
        breakdown = [{"layer": layer, "points": 0, "note": "Scoring unavailable"}
                     for layer in ("proximity", "sensor", "crowd", "role", "gps", "history")]
        return 0, "unverified", breakdown


def _score(*, node, latest, history, open_alerts, crowd_devices, reporter_role, lat, lng,
           false_flags, incident_type) -> tuple[int, str, list[dict]]:
    breakdown: list[dict] = []
    node_id = _get(node, "id", "node")

    prox = 40 if node is not None else 0
    breakdown.append({"layer": "proximity", "points": prox,
                      "note": f"Submitted through node {node_id}'s WiFi" if node is not None
                      else "Submitted over the internet, no node stamp"})

    sensor_pts, sensor_note = _sensor_layer(node, latest, history, open_alerts, incident_type)
    breakdown.append({"layer": "sensor", "points": sensor_pts, "note": sensor_note})

    crowd_pts = min(20 * max(crowd_devices, 0), 40)
    if crowd_devices > 0:
        where = f"at {node_id}" if node is not None else "nearby"
        crowd_note = f"{crowd_devices} other device{'s' if crowd_devices != 1 else ''} reported {incident_type} {where} in 10 min"
    else:
        where = f"at {node_id}" if node is not None else "without a node"
        crowd_note = f"No other devices reported {incident_type} {where} in 10 min"
    breakdown.append({"layer": "crowd", "points": crowd_pts, "note": crowd_note})

    role_pts = 50 if reporter_role in ROLE_TYPES else 0
    breakdown.append({"layer": "role", "points": role_pts,
                      "note": f"Signed-in {reporter_role}" if role_pts else "Anonymous reporter"})

    gps_pts = 0
    if lat is not None and lng is not None and node is not None \
            and _get(node, "lat") is not None and _get(node, "lng") is not None:
        dist = haversine(float(lat), float(lng), float(_get(node, "lat")), float(_get(node, "lng")))
        if dist <= GPS_NEAR_M:
            gps_pts = 10
        elif dist > GPS_FAR_M:
            gps_pts = -30
        gps_note = f"GPS {dist:.0f} m from node"
    elif lat is not None and lng is not None:
        gps_note = "GPS given but no node to compare against"
    else:
        gps_note = "No GPS shared"
    breakdown.append({"layer": "gps", "points": gps_pts, "note": gps_note})

    hist_pts = -40 * max(false_flags, 0)
    breakdown.append({"layer": "history", "points": hist_pts,
                      "note": f"{false_flags} prior false report{'s' if false_flags != 1 else ''}" if false_flags
                      else "No prior false reports"})

    score = sum(int(b["points"]) for b in breakdown)
    score = max(0, min(100, score))
    if node is None and reporter_role is None:
        score = min(score, 59)
        breakdown.append({"layer": "cap", "points": 0, "note": "No node stamp, capped at Likely"})

    if score >= 60:
        label = "verified"
    elif score >= 30:
        label = "likely"
    else:
        label = "unverified"
    return score, label, breakdown
