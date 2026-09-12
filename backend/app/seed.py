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
SCHOOL_LABELS = ["Parent · 3A", "Parent · 3B", "Staff", "Parent · 4A", "Parent · 4B", "Staff",
                 "Parent · 5A", "Parent · 5B", "Staff"]
WAREHOUSE_LABELS = ["Crew lead", "Shift supervisor", "Night crew"]


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
        labels = WAREHOUSE_LABELS if zone_tenant[zone_id] == 2 else SCHOOL_LABELS
        for i in range(1, RECIPIENTS_PER_ZONE + 1):
            rows.append(SmsRecipient(
                tenant_id=zone_tenant[zone_id], zone_id=zone_id,
                phone_e164=f"+1206555{zone_id:02d}{i:02d}",
                label=labels[(i - 1) % len(labels)], consent_at=seed_time,
            ))
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
