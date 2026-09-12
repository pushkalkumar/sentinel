# OWNER: backend-core
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Node

router = APIRouter()


async def node_to_dict(session: AsyncSession, node: Node) -> dict:
    """Node shape from CONTRACT §3.1."""
    raise NotImplementedError


async def compute_node_status(session: AsyncSession, node_id: str) -> str:
    """ok|watch|alert|offline per CONTRACT §3.3."""
    raise NotImplementedError


async def node_status_payload(session: AsyncSession, node_id: str) -> dict:
    """WS node_status data (CONTRACT §6.1)."""
    raise NotImplementedError
