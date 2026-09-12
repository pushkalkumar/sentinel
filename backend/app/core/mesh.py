# OWNER: backend-core
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


async def relay_to_sim(msg_id: str, origin_node: str, kind: str, payload: dict) -> None:
    """POST /relay to the simulator (CONTRACT §7.3)."""
    raise NotImplementedError
