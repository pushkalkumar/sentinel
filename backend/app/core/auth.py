"""Auth (CONTRACT §2): admin/responder login, teacher staff code, /me."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import Principal, SessionDep, require_roles
from app.envelope import ApiError, ok
from app.models import RosterEntry, SchoolClass, Site, Tenant, User
from app.security import sha256, sign_token

router = APIRouter()


class LoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=120)


class StaffBody(BaseModel):
    staff_code: str = Field(min_length=3, max_length=32)


async def _first_site_id(session: AsyncSession, tenant_id: int) -> int | None:
    return (await session.execute(
        select(Site.id).where(Site.tenant_id == tenant_id).order_by(Site.id).limit(1)
    )).scalar_one_or_none()


async def _class_for_teacher(session: AsyncSession, user_id: int) -> SchoolClass | None:
    return (await session.execute(
        select(SchoolClass).where(SchoolClass.teacher_user_id == user_id)
    )).scalar_one_or_none()


async def _class_dict(session: AsyncSession, cls: SchoolClass) -> dict:
    roster = (await session.execute(
        select(RosterEntry.student_ref).where(RosterEntry.class_id == cls.id).order_by(RosterEntry.student_ref)
    )).scalars().all()
    return {
        "id": cls.id, "name": cls.name, "site_id": cls.site_id, "muster_node_id": cls.muster_node_id,
        "roster": list(roster), "roster_size": len(roster),
    }


async def _user_dict(session: AsyncSession, user: User, site_id: int | None) -> dict:
    tenant = await session.get(Tenant, user.tenant_id)
    return {
        "id": user.id, "name": user.name, "email": user.email, "role": user.role,
        "tenant": {"id": tenant.id, "name": tenant.name, "type": tenant.type} if tenant else None,
        "site_id": site_id,
    }


async def _active_drill(session: AsyncSession, site_id: int | None) -> dict | None:
    if site_id is None:
        return None
    from app.drills.service import get_active_drill
    try:
        return await get_active_drill(session, site_id)
    except NotImplementedError:
        return None


async def session_payload(session: AsyncSession, user: User, *, issue_token: bool) -> dict:
    """Login/staff/me data shape (CONTRACT §2.2)."""
    site_id = await _first_site_id(session, user.tenant_id)
    cls = await _class_for_teacher(session, user.id) if user.role == "teacher" else None
    if cls is not None:
        site_id = cls.site_id
    claims = {"uid": user.id, "role": user.role, "tenant_id": user.tenant_id, "site_id": site_id,
              "class_id": cls.id if cls else None, "name": user.name}
    data: dict = {"role": user.role, "user": await _user_dict(session, user, site_id)}
    if issue_token:
        data = {"token": sign_token(claims), **data}
    if cls is not None:
        data["class"] = await _class_dict(session, cls)
        data["active_drill"] = await _active_drill(session, site_id)
    return data


@router.post("/auth/login")
async def login(body: LoginBody, session: SessionDep) -> dict:
    email = body.email.strip().lower()
    user = (await session.execute(
        select(User).where(User.email == email, User.role.in_(("admin", "responder")))
    )).scalar_one_or_none()
    if user is None or not user.password_hash or user.password_hash != sha256(body.password):
        raise ApiError("UNAUTHORIZED", "invalid email or password")
    return ok(await session_payload(session, user, issue_token=True))


@router.post("/auth/staff")
async def staff_login(body: StaffBody, session: SessionDep) -> dict:
    code = "".join(body.staff_code.split()).upper()
    user = (await session.execute(
        select(User).where(User.staff_code_hash == sha256(code), User.role == "teacher")
    )).scalar_one_or_none()
    if user is None:
        raise ApiError("UNAUTHORIZED", "unknown staff code")
    return ok(await session_payload(session, user, issue_token=True))


@router.get("/auth/me")
async def me(session: SessionDep, principal: Principal = Depends(require_roles())) -> dict:
    user = await session.get(User, principal.uid)
    if user is None:
        raise ApiError("UNAUTHORIZED", "user no longer exists")
    return ok(await session_payload(session, user, issue_token=False))
