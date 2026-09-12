"""Demo seed (CONTRACT §1.3). Idempotent: runs only when tenants is empty. `python -m app.seed` resets and reseeds."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.bands import DEFAULT_POLICY
from app.models import (
    DeviceHistory, Node, RosterEntry, SchoolClass, Site, SmsRecipient, Tenant, User, Zone,
)
from app.security import sha256
from app.timefmt import now_iso

log = logging.getLogger("sentinel.seed")

TOPOLOGY_PATH = Path(__file__).resolve().parents[2] / "shared" / "topology.json"
DEMO_PASSWORD = "sentinel"
BLOCKED_DEVICE_FP = "demo-blocked-device"

TENANTS = [
    {"id": 1, "name": "Roosevelt High School", "type": "school", "policy_pack": DEFAULT_POLICY},
    {"id": 2, "name": "Harbor Island Logistics", "type": "warehouse", "policy_pack": {**DEFAULT_POLICY, "pm_rise": 30}},
    {"id": 3, "name": "Seattle Fire Dept / King County OEM", "type": "agency", "policy_pack": {}},
]

USERS = [
    {"id": 1, "tenant_id": 1, "role": "admin", "name": "Dana Whitfield (Principal)", "email": "admin@sentinel.demo"},
    {"id": 2, "tenant_id": 3, "role": "responder", "name": "Lt. Marcus Reyes (SFD Battalion 4)", "email": "responder@sentinel.demo"},
    {"id": 3, "tenant_id": 1, "role": "teacher", "name": "A. Okafor", "staff_code": "T-3A-9K4"},
    {"id": 4, "tenant_id": 1, "role": "teacher", "name": "J. Lindqvist", "staff_code": "T-3B-7Q2"},
    {"id": 5, "tenant_id": 1, "role": "teacher", "name": "R. Patel", "staff_code": "T-4A-2M8"},
    {"id": 6, "tenant_id": 1, "role": "teacher", "name": "M. Castillo", "staff_code": "T-4B-5X3"},
    {"id": 7, "tenant_id": 1, "role": "teacher", "name": "K. Nakamura", "staff_code": "T-5A-8R6"},
    {"id": 8, "tenant_id": 1, "role": "teacher", "name": "S. Haddad", "staff_code": "T-5B-3W9"},
    {"id": 9, "tenant_id": 2, "role": "admin", "name": "Priya Venkat (Ops Manager)", "email": "ops@sentinel.demo"},
]

# (id, name, teacher_user_id, roster_size, muster_node_id) — all at site 1
CLASSES = [
    (1, "3A", 3, 28, "field"),
    (2, "3B", 4, 30, "field"),
    (3, "4A", 5, 27, "parking"),
    (4, "4B", 6, 29, "parking"),
    (5, "5A", 7, 26, "field"),
    (6, "5B", 8, 28, "parking"),
]

RECIPIENTS_PER_ZONE = 12

# 12 recipients per zone, keyed by zone id (CONTRACT §1.3). Numbers sit in the 555-01xx block reserved for
# fiction so a simulated fan-out can never reach a real phone; area codes are Seattle (206) and Eastside (425).
RECIPIENTS: dict[int, list[tuple[str, str]]] = {
    1: [  # Campus North: main hall, library, science wing
        ("+12065550147", "Principal, D. Whitfield"),
        ("+12065550112", "Office manager, L. Tran"),
        ("+14255550163", "Custodial lead, G. Morales"),
        ("+12065550138", "School nurse, B. Feld"),
        ("+12065550129", "Librarian, H. Park"),
        ("+14255550171", "Science dept head, E. Sorensen"),
        ("+12065550104", "Teacher 3A, A. Okafor"),
        ("+14255550156", "Teacher 3B, J. Lindqvist"),
        ("+12065550183", "Parent, 3A (Nguyen)"),
        ("+14255550117", "Parent, 3A (Alvarez)"),
        ("+12065550166", "Parent, 3B (Kim)"),
        ("+12065550191", "Parent, 3B (Osei)"),
    ],
    2: [  # Campus South: cafeteria, arts, gym, field, south lot
        ("+12065550122", "Athletic director, C. Ruiz"),
        ("+14255550134", "Cafeteria manager, R. Singh"),
        ("+12065550158", "Night custodian, P. Abebe"),
        ("+12065550175", "Teacher 4A, R. Patel"),
        ("+14255550142", "Teacher 4B, M. Castillo"),
        ("+12065550109", "Teacher 5A, K. Nakamura"),
        ("+14255550187", "Teacher 5B, S. Haddad"),
        ("+12065550151", "Parent, 4A (Johansson)"),
        ("+14255550126", "Parent, 4B (Delgado)"),
        ("+12065550194", "Parent, 5A (Mbeki)"),
        ("+14255550108", "Parent, 5B (Chen)"),
        ("+12065550133", "Parent, 5B (Walsh)"),
    ],
    3: [  # Harbor Island DC-4, floor 1
        ("+12065550176", "Ops manager, P. Venkat"),
        ("+14255550119", "Day shift supervisor, T. Nguyen"),
        ("+12065550143", "Night shift supervisor, E. Kowalski"),
        ("+14255550188", "Crew lead, aisle A, J. Ortiz"),
        ("+12065550162", "Crew lead, aisle B, M. Haile"),
        ("+14255550137", "Dock lead, S. Brandt"),
        ("+12065550185", "Forklift lead, D. Achebe"),
        ("+14255550154", "Safety officer, L. Moreau"),
        ("+12065550116", "Facilities, R. Dunne"),
        ("+14255550172", "Night crew, A. Petrov"),
        ("+12065550198", "Night crew, K. Yamada"),
        ("+14255550103", "Security desk, truck gate"),
    ],
}


def load_topology(path: Path = TOPOLOGY_PATH) -> dict:
    with path.open() as fh:
        return json.load(fh)


def _tenant_rows() -> list[Tenant]:
    return [Tenant(**t) for t in TENANTS]


def _site_rows(topology: dict) -> tuple[list[Site], list[Zone], list[Node], dict[int, int]]:
    sites: list[Site] = []
    zones: list[Zone] = []
    nodes: list[Node] = []
    zone_tenant: dict[int, int] = {}
    for s in topology["sites"]:
        sites.append(Site(
            id=s["id"], tenant_id=s["tenant_id"], name=s["name"], kind=s["kind"], geom=s["geom"],
            map_asset=s["map_asset"], floor_plan_url=s.get("floor_plan_url"),
            address=s.get("address", ""), access_notes=s.get("access_notes", ""),
        ))
        for z in s["zones"]:
            zones.append(Zone(id=z["id"], site_id=s["id"], name=z["name"], geom=z["geom"], map_poly=z["map_poly"]))
            zone_tenant[z["id"]] = s["tenant_id"]
        for n in s["nodes"]:
            nodes.append(Node(
                id=n["id"], site_id=s["id"], zone_id=n["zone_id"], label=n["label"],
                lat=n["lat"], lng=n["lng"], map_x=n["map_x"], map_y=n["map_y"],
                floor=n.get("floor"), indoor=n["indoor"], is_gateway=n["is_gateway"],
                neighbours=n["neighbours"], fw_version="0.9.2-sim", last_seen=None,
                battery_pct=100.0 if n["indoor"] else 92.0, rssi=-70,
            ))
    return sites, zones, nodes, zone_tenant


def _user_rows() -> list[User]:
    rows = []
    for u in USERS:
        rows.append(User(
            id=u["id"], tenant_id=u["tenant_id"], role=u["role"], name=u["name"],
            email=u.get("email"),
            password_hash=sha256(DEMO_PASSWORD) if u.get("email") else None,
            staff_code_hash=sha256(u["staff_code"]) if u.get("staff_code") else None,
        ))
    return rows


def _class_rows() -> tuple[list[SchoolClass], list[RosterEntry]]:
    classes = []
    roster = []
    for cid, name, teacher_id, size, muster in CLASSES:
        classes.append(SchoolClass(id=cid, site_id=1, name=name, teacher_user_id=teacher_id, muster_node_id=muster))
        roster.extend(RosterEntry(class_id=cid, student_ref=f"S-{name}-{i:02d}") for i in range(1, size + 1))
    return classes, roster


def _recipient_rows(zone_tenant: dict[int, int], seed_time: str) -> list[SmsRecipient]:
    rows = []
    for zone_id in sorted(zone_tenant):
        entries = RECIPIENTS[zone_id]
        assert len(entries) == RECIPIENTS_PER_ZONE, f"zone {zone_id} needs {RECIPIENTS_PER_ZONE} recipients"
        rows.extend(
            SmsRecipient(tenant_id=zone_tenant[zone_id], zone_id=zone_id, phone_e164=phone, label=label,
                         consent_at=seed_time)
            for phone, label in entries
        )
    return rows


async def seed_if_empty(session: AsyncSession) -> bool:
    """Returns True when seed data was written."""
    count = (await session.execute(select(func.count()).select_from(Tenant))).scalar_one()
    if count:
        return False
    seed_time = now_iso()
    topology = load_topology()
    sites, zones, nodes, zone_tenant = _site_rows(topology)
    classes, roster = _class_rows()

    session.add_all(_tenant_rows())
    await session.flush()
    session.add_all(sites)
    await session.flush()
    session.add_all(zones)
    await session.flush()
    session.add_all(nodes)
    session.add_all(_user_rows())
    await session.flush()
    session.add_all(classes)
    await session.flush()
    session.add_all(roster)
    session.add_all(_recipient_rows(zone_tenant, seed_time))
    session.add(DeviceHistory(device_fp=BLOCKED_DEVICE_FP, tenant_id=1, false_flags=3, blocked_at=seed_time))
    await session.commit()
    log.info("seeded %d sites, %d zones, %d nodes, %d users, %d classes, %d roster rows",
             len(sites), len(zones), len(nodes), len(USERS), len(classes), len(roster))
    return True


async def seed_all() -> bool:
    from app.db import SessionLocal
    async with SessionLocal() as session:
        return await seed_if_empty(session)


async def _main() -> None:
    from app.db import init_db
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    await init_db()
    written = await seed_all()
    print("seeded" if written else "already seeded; set SENTINEL_RESET_DB=1 to reseed")


if __name__ == "__main__":
    asyncio.run(_main())
