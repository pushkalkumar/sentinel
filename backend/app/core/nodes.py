"""Nodes (CONTRACT §3.3): list, detail with ssid/banner, readings, and the status rule shared with backend-alerts."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.bands import DEFAULT_POLICY, band_key
from app.deps import Principal, SessionDep, require_roles, same_tenant_or_responder
from app.envelope import ApiError, ok
from app.models import Alert, Node, Reading, Site, Tenant, Zone
from app.state import state
from app.timefmt import iso_plus

router = APIRouter()

READING_FIELDS = ("ts", "pm1", "pm25", "pm10", "temp_c", "rh", "mq2_raw", "rssi", "battery_pct")
WATCH_BANDS = {"unhealthy", "very_unhealthy", "hazardous"}
MAX_MINUTES = 1440
RING_MINUTES = 120


def reading_to_dict(reading: Any) -> dict:
    if isinstance(reading, dict):
        return {k: reading.get(k) for k in READING_FIELDS}
    return {k: getattr(reading, k, None) for k in READING_FIELDS}


async def latest_reading(session: AsyncSession, node_id: str) -> dict | None:
    cached = state.latest.get(node_id)
    if cached:
        return reading_to_dict(cached)
    ring = state.rings.get(node_id)
    if ring:
        return reading_to_dict(ring[-1])
    row = (await session.execute(
        select(Reading).where(Reading.node_id == node_id).order_by(Reading.ts.desc()).limit(1)
    )).scalar_one_or_none()
    return reading_to_dict(row) if row else None


async def open_alerts_for(session: AsyncSession, node_id: str) -> list[Alert]:
    rows = (await session.execute(
        select(Alert).where(Alert.node_id == node_id, Alert.cleared_at.is_(None)).order_by(Alert.priority, Alert.id.desc())
    )).scalars().all()
    return list(rows)


async def site_policy(session: AsyncSession, site_id: int) -> dict:
    tenant = (await session.execute(
        select(Tenant).join(Site, Site.tenant_id == Tenant.id).where(Site.id == site_id)
    )).scalar_one_or_none()
    return (tenant.policy_pack if tenant and tenant.policy_pack else DEFAULT_POLICY)


def status_from(last_seen: str | None, band: str | None, open_alerts: list[Alert]) -> str:
    """CONTRACT §3.3 rule."""
    if last_seen is None:
        return "offline"
    if any(a.priority <= 2 for a in open_alerts):
        return "alert"
    if any(a.priority == 3 for a in open_alerts) or band in WATCH_BANDS:
        return "watch"
    return "ok"


async def _alert_dicts(session: AsyncSession, alerts: list[Alert]) -> list[dict]:
    from app.alerts.serialize import alert_to_dict
    out = []
    for a in alerts:
        try:
            out.append(await alert_to_dict(session, a))
        except NotImplementedError:
            out.append(_bare_alert(a))
    return out


def _bare_alert(a: Alert) -> dict:
    return {
        "id": a.id, "tenant_id": a.tenant_id, "site_id": a.site_id, "zone_id": a.zone_id, "node_id": a.node_id,
        "kind": a.kind, "priority": a.priority, "band_from": a.band_from, "band_to": a.band_to,
        "reason": a.reason, "metrics": a.metrics or {}, "started_at": a.started_at, "cleared_at": a.cleared_at,
        "node_label": None, "zone_name": None,
    }


async def node_to_dict(session: AsyncSession, node: Node) -> dict:
    """Node shape from CONTRACT §3.1."""
    latest = await latest_reading(session, node.id)
    alerts = await open_alerts_for(session, node.id)
    policy = await site_policy(session, node.site_id)
    band = band_key(latest["pm25"], policy) if latest and latest.get("pm25") is not None else None
    last_seen = node.last_seen or (latest["ts"] if latest else None)
    return {
        "id": node.id, "site_id": node.site_id, "zone_id": node.zone_id, "label": node.label,
        "lat": node.lat, "lng": node.lng, "map_x": node.map_x, "map_y": node.map_y,
        "floor": node.floor, "indoor": node.indoor, "is_gateway": node.is_gateway,
        "neighbours": list(node.neighbours or []),
        "fw_version": node.fw_version, "last_seen": last_seen,
        "battery_pct": node.battery_pct if node.battery_pct is not None else (latest or {}).get("battery_pct"),
        "rssi": node.rssi if node.rssi is not None else (latest or {}).get("rssi"),
        "status": status_from(last_seen, band, alerts),
        "band": band,
        "latest": latest,
        "open_alerts": await _alert_dicts(session, alerts),
    }


async def compute_node_status(session: AsyncSession, node_id: str) -> str:
    """ok|watch|alert|offline per CONTRACT §3.3."""
    node = await session.get(Node, node_id)
    if node is None:
        return "offline"
    latest = await latest_reading(session, node_id)
    policy = await site_policy(session, node.site_id)
    band = band_key(latest["pm25"], policy) if latest and latest.get("pm25") is not None else None
    last_seen = node.last_seen or (latest["ts"] if latest else None)
    return status_from(last_seen, band, await open_alerts_for(session, node_id))


async def node_status_payload(session: AsyncSession, node_id: str) -> dict:
    """WS node_status data (CONTRACT §6.1)."""
    node = await session.get(Node, node_id)
    if node is None:
        raise ApiError("NOT_FOUND", f"node {node_id} not found")
    latest = await latest_reading(session, node_id)
    alerts = await open_alerts_for(session, node_id)
    policy = await site_policy(session, node.site_id)
    band = band_key(latest["pm25"], policy) if latest and latest.get("pm25") is not None else None
    last_seen = node.last_seen or (latest["ts"] if latest else None)
    return {
        "node_id": node.id, "site_id": node.site_id,
        "status": status_from(last_seen, band, alerts), "band": band,
        "battery_pct": node.battery_pct if node.battery_pct is not None else (latest or {}).get("battery_pct"),
        "rssi": node.rssi if node.rssi is not None else (latest or {}).get("rssi"),
        "last_seen": last_seen,
        "open_alert_kinds": [a.kind for a in alerts],
    }


def band_label(band: str | None, policy: dict) -> str | None:
    for b in policy.get("bands") or DEFAULT_POLICY["bands"]:
        if b["key"] == band:
            return b["label"]
    return None


async def get_node_or_404(session: AsyncSession, node_id: str) -> Node:
    node = await session.get(Node, node_id)
    if node is None:
        raise ApiError("NOT_FOUND", f"node {node_id} not found")
    return node


# ---------------------------------------------------------------- routes

@router.get("/nodes")
async def list_nodes(session: SessionDep, site_id: int | None = Query(None)) -> dict:
    stmt = select(Node).order_by(Node.site_id, Node.id)
    if site_id is not None:
        stmt = stmt.where(Node.site_id == site_id)
    nodes = (await session.execute(stmt)).scalars().all()
    return ok([await node_to_dict(session, n) for n in nodes])


@router.get("/nodes/{node_id}")
async def get_node(node_id: str, session: SessionDep) -> dict:
    node = await get_node_or_404(session, node_id)
    data = await node_to_dict(session, node)
    site = await session.get(Site, node.site_id)
    zone = await session.get(Zone, node.zone_id)
    policy = await site_policy(session, node.site_id)
    open_alerts = data["open_alerts"]
    top = open_alerts[0] if open_alerts else None
    label = band_label(data["band"], policy)
    if top and top["priority"] <= 2:
        text = "FIRE DETECTED AT THIS NODE. EVACUATE" if top["kind"] == "LOCAL_FIRE" \
            else f"{top['kind'].replace('_', ' ').title()} at this node. Follow staff instructions"
    elif label:
        text = f"Air quality: {label}"
    else:
        text = "Air quality: no readings yet"
    data.update({
        "site": {"id": site.id, "name": site.name, "kind": site.kind} if site else None,
        "zone": {"id": zone.id, "name": zone.name} if zone else None,
        "ssid": f"SENTINEL-{node.id}",
        "banner": {"band": data["band"], "band_label": label, "alert": top, "text": text},
    })
    return ok(data)


@router.get("/nodes/{node_id}/readings")
async def node_readings(
    node_id: str,
    session: SessionDep,
    principal: Principal = Depends(require_roles()),
    minutes: int = Query(60, ge=1, le=MAX_MINUTES),
    limit: int = Query(500, ge=1, le=5000),
) -> dict:
    node = await get_node_or_404(session, node_id)
    site = await session.get(Site, node.site_id)
    same_tenant_or_responder(principal, site.tenant_id if site else node.site_id)

    latest = await latest_reading(session, node_id)
    if latest is None or not latest.get("ts"):
        return ok({"node_id": node_id, "minutes": minutes, "readings": []})
    since = iso_plus(latest["ts"], -minutes * 60)

    ring = state.rings.get(node_id)
    if minutes <= RING_MINUTES and ring:
        readings = [reading_to_dict(r) for r in ring if (r.get("ts") if isinstance(r, dict) else r.ts) >= since]
    else:
        rows = (await session.execute(
            select(Reading).where(Reading.node_id == node_id, Reading.ts >= since).order_by(Reading.ts.asc())
        )).scalars().all()
        readings = [reading_to_dict(r) for r in rows]
    readings.sort(key=lambda r: r["ts"])
    if len(readings) > limit:
        readings = readings[-limit:]
    return ok({"node_id": node_id, "minutes": minutes, "readings": readings})
