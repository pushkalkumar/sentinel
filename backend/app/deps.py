"""FastAPI dependencies: session, principal, role gates, demo headers (CONTRACT §0.7, §2)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Optional

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.envelope import ApiError
from app.security import verify_token

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@dataclass(frozen=True)
class Principal:
    uid: int
    role: str                      # admin|teacher|responder
    tenant_id: int
    site_id: Optional[int] = None
    class_id: Optional[int] = None
    name: str = ""


def principal_from_payload(payload: dict) -> Principal | None:
    try:
        return Principal(
            uid=int(payload["uid"]),
            role=str(payload["role"]),
            tenant_id=int(payload["tenant_id"]),
            site_id=payload.get("site_id"),
            class_id=payload.get("class_id"),
            name=str(payload.get("name", "")),
        )
    except (KeyError, TypeError, ValueError):
        return None


def principal_from_token(token: str | None) -> Principal | None:
    if not token:
        return None
    payload = verify_token(token)
    return principal_from_payload(payload) if payload else None


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


async def current_user(request: Request) -> Principal | None:
    """Bearer is optional; invalid token is treated as anonymous (explicit gates raise)."""
    return principal_from_token(_bearer(request))


CurrentUser = Annotated[Optional[Principal], Depends(current_user)]


def require_roles(*roles: str):
    async def _dep(request: Request) -> Principal:
        token = _bearer(request)
        if token is None:
            raise ApiError("UNAUTHORIZED", "missing bearer token")
        principal = principal_from_token(token)
        if principal is None:
            raise ApiError("UNAUTHORIZED", "invalid or expired token")
        if roles and principal.role not in roles:
            raise ApiError("FORBIDDEN", f"role {principal.role} may not access this resource")
        return principal

    return _dep


def require_sim_key(x_sim_key: str = Header(..., alias="X-Sim-Key")) -> str:
    if x_sim_key != settings.sim_key:
        raise ApiError("UNAUTHORIZED", "bad simulator key")
    return x_sim_key


def device_fp(x_device_fp: str | None = Header(None, alias="X-Device-Fp")) -> str:
    if not x_device_fp or not x_device_fp.strip():
        raise ApiError("MISSING_DEVICE_FP", "X-Device-Fp header is required")
    fp = x_device_fp.strip()
    if len(fp) > 64:
        raise ApiError("VALIDATION_ERROR", "X-Device-Fp must be 64 chars or fewer")
    return fp


def node_id_header(x_node_id: str | None = Header(None, alias="X-Node-Id")) -> str | None:
    return x_node_id.strip() if x_node_id and x_node_id.strip() else None


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def same_tenant_or_responder(principal: Principal | None, tenant_id: int) -> None:
    if principal is None:
        raise ApiError("UNAUTHORIZED", "missing bearer token")
    if principal.role == "responder":
        return
    if principal.tenant_id != tenant_id:
        raise ApiError("FORBIDDEN", "resource belongs to another tenant")
