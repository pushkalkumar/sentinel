"""Drill and roll-call routes (CONTRACT §3.8)."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import Principal, SessionDep, require_roles
from app.drills import service
from app.drills.report import build_csv, build_report
from app.envelope import ApiError, ok
from app.models import Drill, Node, Rollcall, SchoolClass, Site
from app.timefmt import now_iso
from app.ws import hub

router = APIRouter()

AnyStaff = Depends(require_roles("admin", "teacher", "responder"))
AdminOnly = Depends(require_roles("admin"))
RollcallRoles = Depends(require_roles("admin", "teacher"))


class DrillCreate(BaseModel):
    site_id: int
    kind: Literal["fire", "earthquake", "lockdown"]


class RollcallBody(BaseModel):
    class_id: int
    node_id: str = Field(min_length=1, max_length=32)
    present: int = Field(ge=0)
    missing_refs: list[str] = Field(default_factory=list)


async def _site_or_404(session: AsyncSession, site_id: int) -> Site:
    site = await session.get(Site, site_id)
    if site is None:
        raise ApiError("NOT_FOUND", f"site {site_id} not found")
    return site


async def _gate_site(session: AsyncSession, principal: Principal, site_id: int) -> Site:
    """Responder sees every site; admin own tenant; teacher own site (CONTRACT §2.3)."""
    site = await _site_or_404(session, site_id)
    if principal.role == "responder":
        return site
    if principal.role == "teacher" and principal.site_id != site_id:
        raise ApiError("FORBIDDEN", "drill belongs to another site")
    if principal.tenant_id != site.tenant_id:
        raise ApiError("FORBIDDEN", "drill belongs to another tenant")
    return site


async def _drill_or_404(session: AsyncSession, drill_id: int) -> Drill:
    drill = await service.get_drill(session, drill_id)
    if drill is None:
        raise ApiError("NOT_FOUND", f"drill {drill_id} not found")
    return drill


@router.post("/drills", status_code=201)
async def create_drill(body: DrillCreate, session: SessionDep, principal: Principal = AdminOnly) -> dict:
    await _gate_site(session, principal, body.site_id)
    if await service.get_open_drill(session, body.site_id) is not None:
        raise ApiError("CONFLICT", f"a drill is already open at site {body.site_id}")
    drill = Drill(site_id=body.site_id, kind=body.kind, is_real=False, started_at=now_iso(), started_by=principal.uid)
    session.add(drill)
    await session.commit()
    data = await service.drill_to_dict(session, drill)
    await hub.broadcast("drill_started", data)
    return ok(data)


@router.get("/drills")
async def list_drills(
    session: SessionDep,
    site_id: int = Query(...),
    limit: int = Query(20, ge=1, le=200),
    principal: Principal = AnyStaff,
) -> dict:
    await _gate_site(session, principal, site_id)
    stmt = select(Drill).where(Drill.site_id == site_id).order_by(Drill.id.desc()).limit(limit)
    drills = (await session.execute(stmt)).scalars().all()
    return ok([await service.drill_to_dict(session, d, full=False) for d in drills])


@router.get("/drills/active")
async def active_drill(session: SessionDep, site_id: int = Query(...), principal: Principal = AnyStaff) -> dict:
    await _gate_site(session, principal, site_id)
    return ok(await service.get_active_drill(session, site_id))


@router.get("/drills/{drill_id}")
async def get_drill(drill_id: int, session: SessionDep, principal: Principal = AnyStaff) -> dict:
    drill = await _drill_or_404(session, drill_id)
    await _gate_site(session, principal, drill.site_id)
    return ok(await service.drill_to_dict(session, drill))


async def _validate_rollcall(session: AsyncSession, drill: Drill, principal: Principal, body: RollcallBody) -> None:
    cls = await session.get(SchoolClass, body.class_id)
    if cls is None or cls.site_id != drill.site_id:
        raise ApiError("NOT_FOUND", f"class {body.class_id} not found at site {drill.site_id}")
    if principal.role == "teacher" and principal.class_id != cls.id:
        raise ApiError("FORBIDDEN", "teachers may only submit roll call for their own class")
    node = await session.get(Node, body.node_id)
    if node is None or node.site_id != drill.site_id:
        raise ApiError("VALIDATION_ERROR", f"node {body.node_id} does not exist at this site")
    roster = await service.roster_refs(session, cls.id)
    if body.present + len(body.missing_refs) != len(roster):
        raise ApiError("VALIDATION_ERROR", f"present + missing must equal roster size {len(roster)}")
    unknown = [ref for ref in body.missing_refs if ref not in roster]
    if unknown:
        raise ApiError("VALIDATION_ERROR", f"missing_refs not on roster: {', '.join(unknown)}")
    if len(set(body.missing_refs)) != len(body.missing_refs):
        raise ApiError("VALIDATION_ERROR", "missing_refs contains duplicates")


@router.post("/drills/{drill_id}/rollcall")
async def submit_rollcall(
    drill_id: int, body: RollcallBody, session: SessionDep, principal: Principal = RollcallRoles
) -> dict:
    drill = await _drill_or_404(session, drill_id)
    await _gate_site(session, principal, drill.site_id)
    if drill.ended_at is not None:
        raise ApiError("INVALID_TRANSITION", f"drill {drill_id} has ended")
    await _validate_rollcall(session, drill, principal, body)

    stmt = select(Rollcall).where(Rollcall.drill_id == drill_id, Rollcall.class_id == body.class_id)
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing is None:
        existing = Rollcall(drill_id=drill_id, class_id=body.class_id)
        session.add(existing)
    existing.node_id = body.node_id
    existing.present = body.present
    existing.missing_refs = list(body.missing_refs)
    existing.submitted_at = now_iso()
    existing.submitted_by = principal.uid
    await session.commit()

    data = await service.drill_to_dict(session, drill)
    row = next(c for c in data["classes"] if c["class_id"] == body.class_id)
    await hub.broadcast("rollcall", {
        "drill_id": drill.id,
        "class_id": body.class_id,
        "rollcall": row["rollcall"],
        "summary": data["summary"],
        "missing": data["missing"],
    })
    return ok(data)


@router.post("/drills/{drill_id}/end")
async def end_drill(drill_id: int, session: SessionDep, principal: Principal = AdminOnly) -> dict:
    drill = await _drill_or_404(session, drill_id)
    await _gate_site(session, principal, drill.site_id)
    if drill.ended_at is not None:
        raise ApiError("INVALID_TRANSITION", f"drill {drill_id} already ended")
    drill.ended_at = now_iso()
    await session.commit()
    data = await service.drill_to_dict(session, drill)
    await hub.broadcast("drill_ended", data)
    return ok(data)


@router.get("/drills/{drill_id}/report")
async def drill_report(drill_id: int, session: SessionDep, principal: Principal = AnyStaff) -> dict:
    drill = await _drill_or_404(session, drill_id)
    await _gate_site(session, principal, drill.site_id)
    return ok(await build_report(session, drill))


@router.get("/export/drill/{drill_id}.csv")
async def export_drill_csv(drill_id: int, session: SessionDep, principal: Principal = AdminOnly) -> Response:
    """Raw text/csv, not enveloped (CONTRACT §0.2 exception)."""
    drill = await _drill_or_404(session, drill_id)
    await _gate_site(session, principal, drill.site_id)
    body = await build_csv(session, drill)
    return Response(
        content=body,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="sentinel-drill-{drill_id}.csv"'},
    )
