"""Compliance report JSON and CSV export for a drill (CONTRACT §3.8)."""
from __future__ import annotations

import csv
import io

from sqlalchemy.ext.asyncio import AsyncSession

from app.drills.service import drill_to_dict, elapsed_seconds
from app.models import Drill, Site, Tenant, User
from app.timefmt import now_iso

CSV_COLUMNS = ["class", "teacher", "roster_size", "present", "missing_count", "missing_refs",
               "muster_node", "submitted_at", "elapsed_s"]

STATUTE_BY_TENANT_TYPE = {
    "school": "RCW 28A.320.125 (verify current text)",
    "warehouse": "WAC 296-800-310 emergency action plan (verify current text)",
}
STATUTE_DEFAULT = "Local emergency plan (verify current text)"


def time_to_full_rollcall(drill: dict) -> int | None:
    """Seconds from drill start to the last class's submission, or None while any class is pending."""
    rollcalls = [c["rollcall"] for c in drill["classes"]]
    if not rollcalls or any(rc is None for rc in rollcalls):
        return None
    return max(rc["elapsed_s"] for rc in rollcalls)


async def build_report(session: AsyncSession, drill: Drill) -> dict:
    data = await drill_to_dict(session, drill, full=True)
    site = await session.get(Site, drill.site_id)
    tenant = await session.get(Tenant, site.tenant_id) if site else None
    starter = await session.get(User, drill.started_by) if drill.started_by else None
    header = {k: v for k, v in data.items() if k not in ("classes", "missing")}
    return {
        "drill": header,
        "site": {"name": site.name if site else "", "address": site.address if site else ""},
        "started_by_name": starter.name if starter else None,
        "duration_s": elapsed_seconds(drill.started_at, drill.ended_at),
        "compliance": {
            "statute": STATUTE_BY_TENANT_TYPE.get(tenant.type if tenant else "", STATUTE_DEFAULT),
            "kind": drill.kind,
            "all_classes_reported": data["summary"]["pending"] == 0 and data["summary"]["classes"] > 0,
            "time_to_full_rollcall_s": time_to_full_rollcall(data),
        },
        "classes": data["classes"],
        "missing": data["missing"],
        "generated_at": now_iso(),
    }


async def build_csv(session: AsyncSession, drill: Drill) -> str:
    data = await drill_to_dict(session, drill, full=True)
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for c in data["classes"]:
        rc = c["rollcall"]
        writer.writerow([
            c["name"],
            c["teacher_name"],
            c["roster_size"],
            rc["present"] if rc else "",
            len(rc["missing_refs"]) if rc else "",
            " ".join(rc["missing_refs"]) if rc else "",
            rc["node_id"] if rc else c["muster_node_id"],
            rc["submitted_at"] if rc else "",
            rc["elapsed_s"] if rc else "",
        ])
    return buf.getvalue()
