# OWNER: backend-core
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import Principal
from app.models import Incident, IncidentEvent

router = APIRouter()


async def incident_to_dict(session: AsyncSession, inc: Incident) -> dict:
    """Incident (full) shape from CONTRACT §3.1."""
    raise NotImplementedError


async def append_incident_event(
    session: AsyncSession,
    inc: Incident,
    *,
    action: str,
    note: str,
    actor: Principal | None,
    actor_role: str,
    ip: str,
) -> IncidentEvent:
    """Append an incident_events row and broadcast `incident_event`."""
    raise NotImplementedError
