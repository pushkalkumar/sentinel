import os

os.environ["SENTINEL_DB"] = "sqlite+aiosqlite:///:memory:"
os.environ.pop("ANTHROPIC_API_KEY", None)

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.ai import rules
from app.ai.client import CALLS_PER_MINUTE, ClaudeClient
from app.ai.schemas import TriageOutput

SPANISH = "Hay tres niños atrapados en el salón 12, hay humo y la puerta está bloqueada"
ENGLISH = "Two students hurt near the gym stairs, one is bleeding, we can't get the door open"


# ---------------------------------------------------------------- rules (fallback path)

def test_rules_spanish_trapped_children():
    out = rules.triage(SPANISH)
    assert out["type"] == "fire"            # smoke outranks trapped; staff confirm, rules are honest about it
    assert out["count"] == 3
    assert out["language_detected"] == "es"
    assert "smoke" in out["hazards"] and "blocked exit" in out["hazards"]
    assert out["urgency"] == 1
    assert out["basis"] == rules.FALLBACK_BASIS
    assert out["human_decides"]
    assert SPANISH[:40] in out["english_summary"]


def test_rules_english_medical_count_two():
    out = rules.triage(ENGLISH)
    assert out["type"] == "medical"
    assert out["count"] == 2
    assert out["language_detected"] == "en"
    assert out["urgency"] == 2
    assert "stairs" in out["access_notes"].lower()


def test_rules_reporter_fields_fill_gaps_and_never_raise():
    out = rules.triage("help", reported_type="water", reported_count=4)
    assert (out["type"], out["count"]) == ("water", 4)
    garbage = rules.triage(None, reported_type="bogus", reported_count=-1)  # type: ignore[arg-type]
    assert garbage["type"] == "other" and garbage["count"] == 1
    assert rules.triage("")["language_detected"] == "unknown"


def test_rules_safe_and_count_words():
    out = rules.triage("Estamos bien, somos cinco personas en el campo")
    assert (out["type"], out["count"]) == ("safe", 5)
    assert out["urgency"] == 4


# ---------------------------------------------------------------- client without a key

async def test_client_without_key_is_fallback_everywhere():
    c = ClaudeClient(api_key="")
    assert c.live is False
    tri = await c.triage(SPANISH, reported_type="trapped")
    assert tri["basis"] == rules.FALLBACK_BASIS
    assert tri["fallback_reason"] == "ANTHROPIC_API_KEY not set"
    assert tri["rules"]["type"] == "fire" and tri["reported_type"] == "trapped"
    tr = await c.translate(SPANISH, "en")
    assert tr["translated"] is False and tr["text"] == SPANISH and tr["basis"] == rules.FALLBACK_BASIS
    noop = await c.translate(ENGLISH, "en")
    assert noop["translated"] is False and noop["basis"].startswith("no-op")
    br = await c.brief({"x": 1}, "Draft paragraph.")
    assert br["brief"] == "Draft paragraph." and br["basis"].startswith("fallback")
    assert c.calls_used == 0


class _BrokenSdk:
    class messages:  # noqa: N801 - mimics sdk namespace
        @staticmethod
        async def create(**_kwargs):
            raise RuntimeError("simulated network failure")


async def test_client_call_failure_falls_back_and_counts():
    c = ClaudeClient(api_key="")
    c._sdk = _BrokenSdk()
    assert c.live is True
    out = await c.triage(ENGLISH)
    assert out["basis"] == rules.FALLBACK_BASIS
    assert out["type"] == "medical"
    assert "RuntimeError" in out["fallback_reason"]
    assert c.calls_used == 1 and c.failures == 1
    status = c.status()
    assert status["live"] is True and status["calls_used"] == 1 and status["key_env"] == "ANTHROPIC_API_KEY"


async def test_client_rate_cap_stops_calling():
    c = ClaudeClient(api_key="")
    c._sdk = _BrokenSdk()
    for i in range(CALLS_PER_MINUTE + 3):
        await c.triage(f"report number {i} fire")
    assert c.calls_used == CALLS_PER_MINUTE
    assert c.last_error == "rate cap"


# ---------------------------------------------------------------- schema validation

def test_triage_output_schema_rejects_bad_values():
    good = {"type": "fire", "count": 2, "people_detail": "", "hazards": ["smoke"], "access_notes": "",
            "urgency": 1, "language_detected": "en", "english_summary": 'Reporter said "fire".'}
    TriageOutput.model_validate(good)
    for bad in ({**good, "type": "explosion"}, {**good, "urgency": 9}, {**good, "count": 0},
                {**good, "english_summary": ""}):
        with pytest.raises(ValidationError):
            TriageOutput.model_validate(bad)


# ---------------------------------------------------------------- endpoints

@pytest.fixture
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


async def _login(client, email):
    res = await client.post("/api/auth/login", json={"email": email, "password": "sentinel"})
    assert res.status_code == 200, res.text
    return res.json()["data"]["token"]


async def test_ai_endpoints_envelope_and_auth(client):
    status = await client.get("/api/ai/status")
    assert status.status_code == 200
    data = status.json()["data"]
    assert data["live"] is False and data["model"] and data["calls_used"] == 0

    tri = await client.post("/api/ai/triage", json={"text": SPANISH, "type": "trapped"})
    assert tri.status_code == 200
    body = tri.json()
    assert body["ok"] is True and body["error"] is None
    d = body["data"]
    assert {"type", "count", "people_detail", "hazards", "access_notes", "urgency", "language_detected",
            "english_summary", "basis", "human_decides"} <= set(d)
    assert d["language_detected"] == "es" and d["count"] == 3

    bad = await client.post("/api/ai/triage", json={"text": ""})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "VALIDATION_ERROR"

    tr = await client.post("/api/ai/translate", json={"text": SPANISH, "target": "en"})
    assert tr.status_code == 200 and tr.json()["data"]["language_detected"] == "es"

    anon = await client.get("/api/ai/brief?site_id=1")
    assert anon.status_code == 401 and anon.json()["error"]["code"] == "UNAUTHORIZED"

    admin = await _login(client, "admin@sentinel.demo")
    ah = {"Authorization": f"Bearer {admin}"}
    brief = await client.get("/api/ai/brief?site_id=1", headers=ah)
    assert brief.status_code == 200, brief.text
    b = brief.json()["data"]
    assert b["brief"].endswith(".") and b["as_of"].endswith("Z") and b["basis"].startswith("fallback")
    assert "open_alerts" in b["facts"] and "open_incidents" in b["facts"]

    other_tenant = await client.get("/api/ai/brief?site_id=2", headers=ah)
    assert other_tenant.status_code == 403

    missing = await client.get("/api/ai/brief?site_id=999", headers=ah)
    assert missing.status_code == 404
