"""Situation brief facts. Read-only selects against the live DB, then a deterministic paragraph.
The model (client.brief) may only rephrase this paragraph; it never sees anything else."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, Incident, Site
from app.timefmt import now_iso

OPEN_INCIDENT_STATUSES = ("received", "acknowledged", "en_route")
MAX_ROWS = 25


async def gather_facts(session: AsyncSession, site: Site) -> dict:
    from app.alerts.decision import get_decision_card   # read-only helper owned by backend-alerts

    try:
        card = await get_decision_card(session, site.id)
    except Exception:  # noqa: BLE001 - a brief with no card is still a brief
        card = None
    alerts = (await session.execute(
        select(Alert).where(Alert.site_id == site.id, Alert.cleared_at.is_(None))
        .order_by(Alert.priority.asc(), Alert.started_at.desc()).limit(MAX_ROWS)
    )).scalars().all()
    incidents = (await session.execute(
        select(Incident).where(Incident.site_id == site.id, Incident.status.in_(OPEN_INCIDENT_STATUSES))
        .order_by(Incident.priority.asc(), Incident.trust_score.desc()).limit(MAX_ROWS)
    )).scalars().all()
    return {
        "site": {"id": site.id, "name": site.name, "kind": site.kind, "access_notes": site.access_notes},
        "decision_card": None if card is None else {
            "band": card.get("band"), "pm25": card.get("pm25"), "node_label": card.get("node_label"),
            "headline": card.get("headline"), "guidance": card.get("guidance"), "as_of": card.get("as_of"),
        },
        "open_alerts": [{"kind": a.kind, "priority": a.priority, "node_id": a.node_id, "reason": a.reason,
                         "started_at": a.started_at} for a in alerts],
        "open_incidents": [{"code": i.code, "type": i.type, "count": i.count, "status": i.status,
                            "trust_label": i.trust_label, "node_id": i.node_id, "text": i.text[:120]}
                           for i in incidents],
        "as_of": now_iso(),
    }


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def template(facts: dict) -> str:
    site = facts["site"]
    card = facts.get("decision_card")
    alerts = facts["open_alerts"]
    incidents = facts["open_incidents"]
    parts = []
    if card and card.get("band"):
        parts.append(f"{site['name']}: air quality band is {card['band']} "
                     f"(PM2.5 {card['pm25']} at {card['node_label']}); guidance: {card['guidance']}")
    else:
        parts.append(f"{site['name']}: no air-quality decision has been recorded yet")
    if alerts:
        top = alerts[0]
        where = f" at node {top['node_id']}" if top.get("node_id") else ""
        why = f" ({top['reason']})" if top.get("reason") else ""
        parts.append(f"{_plural(len(alerts), 'sensor alert')} open; highest priority is {top['kind']}{where}{why}")
    else:
        parts.append("no sensor alerts are open")
    if incidents:
        by_type: dict[str, int] = {}
        people = 0
        for inc in incidents:
            by_type[inc["type"]] = by_type.get(inc["type"], 0) + 1
            people += inc["count"] or 0
        kinds = ", ".join(f"{n} {t}" for t, n in sorted(by_type.items(), key=lambda kv: -kv[1]))
        verified = sum(1 for i in incidents if i["trust_label"] == "verified")
        parts.append(f"{_plural(len(incidents), 'civilian report')} open ({kinds}) covering about "
                     f"{_plural(people, 'person').replace('persons', 'people')}, {verified} verified")
    else:
        parts.append("no civilian reports are open")
    if site.get("access_notes"):
        parts.append(f"site access note: {site['access_notes']}")
    return ". ".join(p.rstrip(".")[:1].upper() + p.rstrip(".")[1:] for p in parts) + "."
