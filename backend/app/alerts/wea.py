"""WEA draft generator (CONTRACT §3.6 shape, NOVELTY §3.3 rules). Deterministic template, no LLM, nothing is sent."""
from __future__ import annotations

import math
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.alerts.serialize import node_index, site_index, zone_index
from app.deps import Principal, SessionDep, require_roles, same_tenant_or_responder
from app.envelope import ApiError, ok
from app.models import Alert, Tenant
from app.timefmt import iso_plus, sim_hhmm

router = APIRouter()

MAX_90 = 90
MAX_360 = 360
MAX_VERTICES = 100
EXPIRES_S = 2 * 3600
DEFAULT_SENDER = "Seattle Fire Dept / King County OEM"
DISCLAIMER = ("Sentinel drafts. Only an authorised agency can issue a WEA through FEMA IPAWS. "
              "Nothing is sent from this screen.")

EVENT = {
    "LOCAL_FIRE": {"event_code": "FRW", "event": "Fire Warning", "severity": "Extreme",
                   "urgency": "Immediate", "certainty": "Observed"},
    "HAZARDOUS_SMOKE": {"event_code": "AQA", "event": "Air Quality Alert", "severity": "Severe",
                        "urgency": "Immediate", "certainty": "Observed"},
}


def truncate_words(text: str, limit: int) -> str:
    """Cut at a word boundary so the result is <= limit characters."""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(" ")
    cut = cut[:space] if space > 0 else cut
    return cut.rstrip(" ,;:")


def _perp_dist(pt: list[float], a: list[float], b: list[float]) -> float:
    ax, ay, bx, by, px, py = a[0], a[1], b[0], b[1], pt[0], pt[1]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def douglas_peucker(points: list[list[float]], epsilon: float) -> list[list[float]]:
    if len(points) < 3:
        return list(points)
    index, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        d = _perp_dist(points[i], points[0], points[-1])
        if d > dmax:
            index, dmax = i, d
    if dmax > epsilon:
        left = douglas_peucker(points[:index + 1], epsilon)
        right = douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def simplify_ring(ring: list[list[float]], max_vertices: int = MAX_VERTICES) -> tuple[list[list[float]], bool]:
    """GeoJSON ring (closed). Runs Douglas-Peucker with a growing epsilon until <= max_vertices."""
    if len(ring) <= max_vertices:
        return list(ring), False
    epsilon = 1e-6
    out = ring
    while len(out) > max_vertices and epsilon < 1.0:
        out = douglas_peucker(ring, epsilon)
        epsilon *= 2
    return out, True


def cap_xml(draft: dict, polygon_ring: list[list[float]], sent: str) -> str:
    poly = " ".join(f"{lat:.5f},{lng:.5f}" for lng, lat in polygon_ring)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">\n'
        f"  <identifier>SENTINEL-{draft['alert_id']}</identifier>\n"
        f"  <sender>{escape(draft['sender'])}</sender>\n"
        f"  <sent>{sent}</sent>\n"
        "  <status>Exercise</status>\n  <msgType>Alert</msgType>\n  <scope>Public</scope>\n"
        "  <info>\n"
        f"    <category>{'Fire' if draft['event_code'] == 'FRW' else 'Env'}</category>\n"
        f"    <event>{escape(draft['event'])}</event>\n"
        f"    <urgency>{draft['urgency']}</urgency>\n    <severity>{draft['severity']}</severity>\n"
        f"    <certainty>{draft['certainty']}</certainty>\n"
        f"    <eventCode><valueName>SAME</valueName><value>{draft['event_code']}</value></eventCode>\n"
        f"    <expires>{draft['expires']}</expires>\n"
        f"    <senderName>{escape(draft['sender'])}</senderName>\n"
        f"    <headline>{escape(draft['headline'])}</headline>\n"
        f"    <description>{escape(draft['text_360'])}</description>\n"
        f"    <parameter><valueName>CMAMtext</valueName><value>{escape(draft['text_90'])}</value></parameter>\n"
        f"    <parameter><valueName>CMAMlongtext</valueName><value>{escape(draft['text_360'])}</value></parameter>\n"
        f"    <area>\n      <areaDesc>{escape(draft['area_description'])}</areaDesc>\n"
        f"      <polygon>{poly}</polygon>\n    </area>\n"
        "  </info>\n</alert>"
    )


def build_draft(alert_dict: dict, site: dict, zone: dict, nodes_affected: int, sender: str) -> dict:
    kind = alert_dict["kind"]
    spec = EVENT[kind]
    node_label = alert_dict.get("node_label") or alert_dict.get("node_id") or "a node"
    hhmm = sim_hhmm(alert_dict["started_at"])
    pm = float((alert_dict.get("metrics") or {}).get("pm25", 0))
    street = (site.get("address") or "").split(",")[0].strip()
    avoid = f" Avoid {street}." if street else ""
    if kind == "LOCAL_FIRE":
        headline = f"Structure fire reported at {site['name']} {node_label}"
        text_90 = f"Fire at {site['name']}, {node_label}. Avoid area. Follow evacuation instructions."
        text_360 = (f"{sender}: Sentinel sensors detected a fire at {site['name']} {node_label} at {hhmm}. "
                    f"{zone['name']} is evacuating to muster points. {nodes_affected} node(s) affected, PM2.5 {pm:.0f}."
                    f"{avoid} Do not re-enter buildings until cleared. Do not call 911 for information.")
    else:
        headline = f"Hazardous air quality at {site['name']}"
        text_90 = f"Hazardous smoke at {site['name']}. Shelter indoors, close windows. Check local news."
        text_360 = (f"{sender}: Sentinel sensors at {site['name']} report hazardous air quality (PM2.5 {pm:.0f}) "
                    f"since {hhmm}, {nodes_affected} node(s) affected in {zone['name']}. Shelter indoors, close windows, "
                    f"run filtration, limit travel.{avoid} Do not call 911 for information.")
    ring = (zone.get("geom") or {}).get("coordinates", [[]])[0] if zone.get("geom") else []
    simplified_ring, simplified = simplify_ring(ring)
    polygon = {"type": "Polygon", "coordinates": [simplified_ring]} if simplified_ring else (zone.get("geom") or {})
    if kind == "LOCAL_FIRE":
        eligible, note = True, ("Eligible: priority 1 fire at a sensor node. Agencies normally wait for two nodes; "
                                "a confirmed structure fire is the exception.")
        if nodes_affected >= 2:
            note = f"Eligible: priority 1 across {nodes_affected} nodes in {zone['name']}."
    else:
        eligible = nodes_affected >= 2
        note = (f"Eligible: priority 2 across {nodes_affected} nodes in {zone['name']}." if eligible
                else "Not yet eligible: hazardous smoke must be seen by two or more nodes in the zone.")
    draft = {
        "alert_id": alert_dict["id"],
        "kind": kind,
        "event_code": spec["event_code"],
        "event": spec["event"],
        "severity": spec["severity"],
        "urgency": spec["urgency"],
        "certainty": spec["certainty"],
        "headline": headline,
        "text_90": truncate_words(text_90, MAX_90),
        "text_360": truncate_words(text_360, MAX_360),
        "polygon": polygon,
        "vertex_count": len(simplified_ring),
        "simplified": simplified,
        "area_description": f"{site['name']}, {zone['name']} zone",
        "sender": sender,
        "sent_time": None,
        "expires": iso_plus(alert_dict["started_at"], EXPIRES_S),
        "nodes_affected": nodes_affected,
        "eligible": eligible,
        "eligibility_note": note,
        "disclaimer": DISCLAIMER,
    }
    draft["cap_xml"] = cap_xml(draft, simplified_ring, alert_dict["started_at"])
    return draft


@router.get("/wea/draft")
async def wea_draft(session: SessionDep, alert_id: int = Query(...),
                    principal: Principal = Depends(require_roles("responder", "admin"))) -> dict:
    from app.alerts.serialize import alert_to_dict

    alert = await session.get(Alert, alert_id)
    if alert is None:
        raise ApiError("NOT_FOUND", f"alert {alert_id} not found")
    same_tenant_or_responder(principal, alert.tenant_id)
    if alert.priority > 2:
        raise ApiError("INVALID_TRANSITION", "WEA drafts exist only for priority 1 and 2 alerts")
    sites = await site_index(session)
    zones = await zone_index(session)
    await node_index(session)
    site = sites.get(alert.site_id)
    zone = zones.get(alert.zone_id)
    if site is None or zone is None:
        raise ApiError("NOT_FOUND", "alert site or zone missing")
    affected = (await session.execute(
        select(Alert.node_id).where(Alert.zone_id == alert.zone_id, Alert.priority <= 2, Alert.cleared_at.is_(None))
    )).all()
    nodes_affected = len({r[0] for r in affected if r[0]}) or 1
    sender = DEFAULT_SENDER
    if principal.role == "responder":
        tenant = await session.get(Tenant, principal.tenant_id)
        if tenant and tenant.type == "agency":
            sender = tenant.name
    return ok(build_draft(await alert_to_dict(session, alert), site, zone, nodes_affected, sender))
