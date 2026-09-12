"""Drill serialisation and shared lookups (CONTRACT §3.1 `Drill`, §3.8)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Drill, Node, Rollcall, RosterEntry, SchoolClass, User
from app.timefmt import now_iso, parse_iso


def elapsed_seconds(start_iso: str, end_iso: str | None) -> int:
    """Wall seconds between two contract timestamps; `end_iso` None means now."""
    end = parse_iso(end_iso) if end_iso else parse_iso(now_iso())
    return max(0, int((end - parse_iso(start_iso)).total_seconds()))


async def get_drill(session: AsyncSession, drill_id: int) -> Drill | None:
    return await session.get(Drill, drill_id)


async def get_open_drill(session: AsyncSession, site_id: int) -> Drill | None:
    stmt = (
        select(Drill)
        .where(Drill.site_id == site_id, Drill.ended_at.is_(None))
        .order_by(Drill.id.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_active_drill(session: AsyncSession, site_id: int) -> dict | None:
    """Open Drill (CONTRACT §3.1) at the site, or None."""
    drill = await get_open_drill(session, site_id)
    if drill is None:
        return None
    return await drill_to_dict(session, drill)


async def site_classes(session: AsyncSession, site_id: int) -> list[tuple[SchoolClass, str, int]]:
    """(class, teacher_name, roster_size) for every class at the site, ordered by name."""
    stmt = (
        select(SchoolClass, User.name)
        .join(User, User.id == SchoolClass.teacher_user_id)
        .where(SchoolClass.site_id == site_id)
        .order_by(SchoolClass.name)
    )
    rows = (await session.execute(stmt)).all()
    sizes = await roster_sizes(session, [cls.id for cls, _ in rows])
    return [(cls, teacher_name, sizes.get(cls.id, 0)) for cls, teacher_name in rows]


async def roster_sizes(session: AsyncSession, class_ids: list[int]) -> dict[int, int]:
    if not class_ids:
        return {}
    stmt = (
        select(RosterEntry.class_id, func.count())
        .where(RosterEntry.class_id.in_(class_ids))
        .group_by(RosterEntry.class_id)
    )
    return {class_id: count for class_id, count in (await session.execute(stmt)).all()}


async def roster_refs(session: AsyncSession, class_id: int) -> set[str]:
    stmt = select(RosterEntry.student_ref).where(RosterEntry.class_id == class_id)
    return set((await session.execute(stmt)).scalars().all())


async def node_labels(session: AsyncSession, site_id: int) -> dict[str, str]:
    rows = (await session.execute(select(Node.id, Node.label).where(Node.site_id == site_id))).all()
    return {node_id: label for node_id, label in rows}


async def drill_rollcalls(session: AsyncSession, drill_id: int) -> dict[int, Rollcall]:
    rows = (await session.execute(select(Rollcall).where(Rollcall.drill_id == drill_id))).scalars().all()
    return {rc.class_id: rc for rc in rows}


def rollcall_to_dict(rc: Rollcall, labels: dict[str, str], started_at: str) -> dict:
    return {
        "id": rc.id,
        "node_id": rc.node_id,
        "node_label": labels.get(rc.node_id, rc.node_id),
        "present": rc.present,
        "missing_refs": list(rc.missing_refs or []),
        "submitted_at": rc.submitted_at,
        "elapsed_s": elapsed_seconds(started_at, rc.submitted_at),
    }


def class_state(rc: Rollcall | None) -> str:
    if rc is None:
        return "pending"
    return "missing" if rc.missing_refs else "matched"


def build_classes(
    classes: list[tuple[SchoolClass, str, int]],
    rollcalls: dict[int, Rollcall],
    labels: dict[str, str],
    started_at: str,
) -> list[dict]:
    out = []
    for cls, teacher_name, roster_size in classes:
        rc = rollcalls.get(cls.id)
        out.append({
            "class_id": cls.id,
            "name": cls.name,
            "teacher_name": teacher_name,
            "roster_size": roster_size,
            "muster_node_id": cls.muster_node_id,
            "state": class_state(rc),
            "rollcall": rollcall_to_dict(rc, labels, started_at) if rc else None,
        })
    return out


def build_summary(classes: list[dict]) -> dict:
    submitted = [c for c in classes if c["rollcall"] is not None]
    with_missing = [c for c in submitted if c["state"] == "missing"]
    return {
        "classes": len(classes),
        "submitted": len(submitted),
        "matched": len(submitted) - len(with_missing),
        "with_missing": len(with_missing),
        "pending": len(classes) - len(submitted),
        "present_total": sum(c["rollcall"]["present"] for c in submitted),
        "missing_total": sum(len(c["rollcall"]["missing_refs"]) for c in submitted),
        "roster_total": sum(c["roster_size"] for c in classes),
    }


def build_missing(classes: list[dict]) -> list[dict]:
    out = []
    for c in classes:
        rc = c["rollcall"]
        if not rc:
            continue
        out.extend(
            {"student_ref": ref, "class_name": c["name"], "node_label": rc["node_label"]}
            for ref in rc["missing_refs"]
        )
    return out


async def drill_to_dict(session: AsyncSession, drill: Drill, full: bool = True) -> dict:
    """Drill shape (CONTRACT §3.1). `full=False` drops `classes` and `missing` but keeps `summary`."""
    classes_raw = await site_classes(session, drill.site_id)
    rollcalls = await drill_rollcalls(session, drill.id)
    labels = await node_labels(session, drill.site_id)
    classes = build_classes(classes_raw, rollcalls, labels, drill.started_at)
    data = {
        "id": drill.id,
        "site_id": drill.site_id,
        "kind": drill.kind,
        "is_real": bool(drill.is_real),
        "started_at": drill.started_at,
        "ended_at": drill.ended_at,
        "started_by": drill.started_by,
        "elapsed_s": elapsed_seconds(drill.started_at, drill.ended_at),
        "summary": build_summary(classes),
    }
    if full:
        data["classes"] = classes
        data["missing"] = build_missing(classes)
    return data
