"""Alert row -> CONTRACT §3.1 dict, plus a small node/zone label cache shared by the alerts package."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, Node, Site, Zone

_node_cache: dict[str, dict] = {}
_zone_cache: dict[int, dict] = {}
_site_cache: dict[int, dict] = {}


async def node_index(session: AsyncSession) -> dict[str, dict]:
    """node_id -> {id, label, site_id, zone_id, indoor, lat, lng}. Nodes are seeded once, so cache for the process."""
    if not _node_cache:
        rows = (await session.execute(select(Node))).scalars().all()
        for n in rows:
            _node_cache[n.id] = {"id": n.id, "label": n.label, "site_id": n.site_id, "zone_id": n.zone_id,
                                 "indoor": bool(n.indoor), "lat": n.lat, "lng": n.lng}
    return _node_cache


async def zone_index(session: AsyncSession) -> dict[int, dict]:
    if not _zone_cache:
        rows = (await session.execute(select(Zone))).scalars().all()
        for z in rows:
            _zone_cache[z.id] = {"id": z.id, "site_id": z.site_id, "name": z.name, "geom": z.geom}
    return _zone_cache


async def site_index(session: AsyncSession) -> dict[int, dict]:
    if not _site_cache:
        rows = (await session.execute(select(Site))).scalars().all()
        for s in rows:
            _site_cache[s.id] = {"id": s.id, "tenant_id": s.tenant_id, "name": s.name, "kind": s.kind,
                                 "address": s.address}
    return _site_cache


async def alert_to_dict(session: AsyncSession, alert: Alert) -> dict:
    """Alert shape from CONTRACT §3.1 (denormalised node_label, zone_name)."""
    nodes = await node_index(session)
    zones = await zone_index(session)
    node = nodes.get(alert.node_id or "")
    zone = zones.get(alert.zone_id)
    return {
        "id": alert.id,
        "tenant_id": alert.tenant_id,
        "site_id": alert.site_id,
        "zone_id": alert.zone_id,
        "node_id": alert.node_id,
        "kind": alert.kind,
        "priority": alert.priority,
        "band_from": alert.band_from,
        "band_to": alert.band_to,
        "reason": alert.reason,
        "metrics": alert.metrics or {},
        "started_at": alert.started_at,
        "cleared_at": alert.cleared_at,
        "node_label": node["label"] if node else None,
        "zone_name": zone["name"] if zone else "",
    }
