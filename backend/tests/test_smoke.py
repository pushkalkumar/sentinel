import os

os.environ["SENTINEL_DB"] = "sqlite+aiosqlite:///:memory:"

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_health_envelope():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True and body["error"] is None
    assert body["data"]["db"] is True
    assert body["data"]["version"] == "0.1.0"
