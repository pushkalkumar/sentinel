"""/api/ai: Gemini second-opinion endpoints. Rules and humans decide; these annotate (spec §11.2)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.ai import brief as brief_facts
from app.ai.client import client
from app.ai.schemas import TranslateRequest, TriageRequest
from app.deps import Principal, SessionDep, require_roles, same_tenant_or_responder
from app.envelope import ApiError, ok
from app.models import Site

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/triage")
async def triage(body: TriageRequest) -> dict:
    return ok(await client.triage(body.text, body.type, body.count))


@router.post("/translate")
async def translate(body: TranslateRequest) -> dict:
    return ok(await client.translate(body.text, body.target))


@router.get("/brief")
async def brief(session: SessionDep, site_id: int = Query(..., ge=1),
                principal: Principal = Depends(require_roles("admin", "responder"))) -> dict:
    site = await session.get(Site, site_id)
    if site is None:
        raise ApiError("NOT_FOUND", f"site {site_id} not found")
    same_tenant_or_responder(principal, site.tenant_id)
    facts = await brief_facts.gather_facts(session, site)
    draft = brief_facts.template(facts)
    result = await client.brief(facts, draft)
    return ok({"site_id": site_id, "as_of": facts["as_of"], "facts": facts, **result,
               "human_decides": "Brief is a reading of stored rows, not an instruction. Verify before acting."})


@router.get("/status")
async def status() -> dict:
    return ok(client.status())
