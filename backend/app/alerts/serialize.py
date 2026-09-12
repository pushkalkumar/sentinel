# OWNER: backend-alerts
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert


async def alert_to_dict(session: AsyncSession, alert: Alert) -> dict:
    """Alert shape from CONTRACT §3.1 (denormalised node_label, zone_name)."""
    raise NotImplementedError
