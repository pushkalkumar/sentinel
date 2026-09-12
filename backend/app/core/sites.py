"""Sites (CONTRACT §3.4): list and the /admin overview. air and decision-card belong to backend-alerts."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ws
from app.core.incidents import OPEN_STATUSES, incident_to_dict
from app.core.nodes import _alert_dicts, node_to_dict
from app.deps import Principal, SessionDep, require_roles, same_tenant_or_responder
from app.envelope import ApiError, ok
from app.models import Alert, Incident, Node, Site, SmsLog, SmsRecipient, Tenant, Zone
from app.timefmt import now_iso

router = APIRouter()

VIEW_BOX = "0 0 1000 700"


def _site_summary(site: Site, node_count: int, zone_count: int) -> dict:
    return {
        "id": site.id, "tenant_id": site.tenant_id, "name": site.name, "kind": site.kind,
        "map_asset": site.map_asset, "floor_plan_url": site.floor_plan_url, "address": site.address,
        "node_count": node_count, "zone_count": zone_count,
    }


async def _count(session: AsyncSession, stmt) -> int:
    return (await session.execute(stmt)).scalar_one()


async def _decision_card(session: AsyncSession, site_id: int) -> dict | None:
    """Judge item 3: the overview only ever carries this site's card, never the one a neighbouring tenant
    happened to recompute last."""
    from app.alerts.decision import get_decision_card
    try:
        card = await get_decision_card(session, site_id)
    except NotImplementedError:
        return None
    if card is None or card.get("site_id") != site_id:
        return None
    return card


async def _active_drill(session: AsyncSession, site_id: int) -> dict | None:
    from app.drills.service import get_active_drill
    try:
        return await get_active_drill(session, site_id)
    except NotImplementedError:
        return None


def dedupe_links(nodes: list[Node]) -> list[list[str]]:
    ids = {n.id for n in nodes}
    seen: set[tuple[str, str]] = set()
    links: list[list[str]] = []
    for n in nodes:
        for other in n.neighbours or []:
            if other not in ids:
                continue
            key = tuple(sorted((n.id, other)))
            if key in seen:
                continue
            seen.add(key)
            links.append([n.id, other])
    return links


async def _sms_sent_today(session: AsyncSession, zone_ids: list[int]) -> int:
    if not zone_ids:
        return 0
    day_start = now_iso()[:10] + "T00:00:00.000Z"
    return await _count(session, select(func.count()).select_from(SmsLog).where(
        SmsLog.zone_id.in_(zone_ids), SmsLog.sent_at >= day_start))


@router.get("/sites")
async def list_sites(session: SessionDep, principal: Principal = Depends(require_roles())) -> dict:
    stmt = select(Site).order_by(Site.id)
    if principal.role != "responder":
        stmt = stmt.where(Site.tenant_id == principal.tenant_id)
    sites = (await session.execute(stmt)).scalars().all()
    out = []
    for site in sites:
        node_count = await _count(session, select(func.count()).select_from(Node).where(Node.site_id == site.id))
        zone_count = await _count(session, select(func.count()).select_from(Zone).where(Zone.site_id == site.id))
        out.append(_site_summary(site, node_count, zone_count))
    return ok(out)


@router.get("/sites/{site_id}/overview")
async def site_overview(site_id: int, session: SessionDep, principal: Principal = Depends(require_roles())) -> dict:
    site = await session.get(Site, site_id)
    if site is None:
        raise ApiError("NOT_FOUND", f"site {site_id} not found")
    same_tenant_or_responder(principal, site.tenant_id)
    tenant = await session.get(Tenant, site.tenant_id)

    nodes = list((await session.execute(select(Node).where(Node.site_id == site_id).order_by(Node.id))).scalars().all())
    zones = list((await session.execute(select(Zone).where(Zone.site_id == site_id).order_by(Zone.id))).scalars().all())
    zone_ids = [z.id for z in zones]

    recipient_counts = dict((await session.execute(
        select(SmsRecipient.zone_id, func.count()).where(
            SmsRecipient.zone_id.in_(zone_ids), SmsRecipient.opted_out_at.is_(None),
        ).group_by(SmsRecipient.zone_id)
    )).all()) if zone_ids else {}

    node_dicts = [await node_to_dict(session, n) for n in nodes]
    open_alerts = list((await session.execute(
        select(Alert).where(Alert.site_id == site_id, Alert.cleared_at.is_(None)).order_by(Alert.priority, Alert.id.desc())
    )).scalars().all())
    open_incidents = list((await session.execute(
        select(Incident).where(Incident.site_id == site_id, Incident.status.in_(OPEN_STATUSES))
        .order_by(Incident.priority.asc(), Incident.trust_score.desc(), Incident.created_at.desc())
    )).scalars().all())

    return ok({
        "site": {
            "id": site.id, "tenant_id": site.tenant_id, "name": site.name, "kind": site.kind,
            "map_asset": site.map_asset, "floor_plan_url": site.floor_plan_url, "view_box": VIEW_BOX,
            "address": site.address, "access_notes": site.access_notes,
        },
        "tenant": {"id": tenant.id, "name": tenant.name, "type": tenant.type} if tenant else None,
        "zones": [{
            "id": z.id, "name": z.name, "map_poly": z.map_poly,
            "recipient_count": recipient_counts.get(z.id, 0),
            "node_ids": [n.id for n in nodes if n.zone_id == z.id],
        } for z in zones],
        "nodes": node_dicts,
        "links": dedupe_links(nodes),
        "decision_card": await _decision_card(session, site_id),
        "open_alerts": await _alert_dicts(session, open_alerts),
        "open_incidents": [await incident_to_dict(session, inc) for inc in open_incidents],
        "active_drill": await _active_drill(session, site_id),
        "stats": {
            "nodes_online": sum(1 for n in node_dicts if n["status"] != "offline"),
            "nodes_alerting": sum(1 for n in node_dicts if n["status"] == "alert"),
            "open_incidents": len(open_incidents),
            "sms_sent_today": await _sms_sent_today(session, zone_ids),
            "recipients": sum(recipient_counts.values()),
        },
        "sim": ws.sim_state_for_clients(),
    })
