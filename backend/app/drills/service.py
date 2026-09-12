# OWNER: backend-drills
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Drill


async def get_active_drill(session: AsyncSession, site_id: int) -> dict | None:
    """Open Drill (CONTRACT §3.1) at the site, or None."""
    return None


async def drill_to_dict(session: AsyncSession, drill: Drill, full: bool = True) -> dict:
    raise NotImplementedError
