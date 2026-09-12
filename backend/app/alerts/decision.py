# OWNER: backend-alerts
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


async def get_decision_card(session: AsyncSession, site_id: int, log_limit: int = 20) -> dict | None:
    """DecisionCard shape from CONTRACT §3.1; None until the site has a band."""
    return None
