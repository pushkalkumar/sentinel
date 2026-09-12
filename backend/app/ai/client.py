"""Gemini second-opinion client. Rules decide; the model annotates. Never raises to callers.

Live path: plain httpx POST to the Gemini REST API (no SDK), JSON mode with a responseSchema derived from
the Pydantic output models, 8 s timeout, no retries (the deadline is the product requirement), in-memory
cache keyed by input hash, 20 calls/min cap. Any failure, or no GEMINI_API_KEY, returns the deterministic
keyword result with basis 'fallback: keyword rules'."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from collections import deque
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.ai import rules
from app.ai.schemas import BriefOutput, TranslateOutput, TriageOutput

log = logging.getLogger("sentinel.ai")

DEFAULT_MODEL = "gemini-2.5-flash"
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT_S = 8.0
MAX_TOKENS = 1024
CALLS_PER_MINUTE = 20
CACHE_MAX = 512
API_KEY_ENV = "GEMINI_API_KEY"
# Keys the Gemini responseSchema (OpenAPI subset) accepts; everything else Pydantic emits is dropped.
SCHEMA_KEYS = ("type", "description", "enum", "items", "properties", "required", "minimum", "maximum", "maxItems")

SYSTEM_PROMPT = (
    "You are a triage assistant for a school emergency console (Sentinel). You read short civilian reports "
    "and return a structured second opinion. You never dispatch, never instruct anyone to act, and never "
    "decide whether an alert opens or closes: sensor rules and human staff do that. "
    "Output only JSON matching the response schema exactly. Do not invent facts that are not in "
    "the report; when the report does not say, use the neutral default (count 1, empty strings). "
    "In english_summary keep the reporter's exact words inside double quotes, then add at most one sentence "
    "of plain-English reading. Reports may be in any language; detect it (ISO 639-1 code) and answer in English."
)
TRANSLATE_SYSTEM = (
    "You are a translation assistant for a school emergency console. Translate the reporter's text faithfully "
    "into the requested language. Add nothing, drop nothing, do not summarise. Output only JSON matching the schema."
)
BRIEF_SYSTEM = (
    "You are a situation-brief assistant for a school emergency console. You receive a list of facts pulled "
    "from the live database and a draft paragraph built from them. Rewrite the draft into one plain-English "
    "paragraph a responder can read in ten seconds. Use only the facts given; never add numbers, places or "
    "causes that are not listed. You never dispatch or recommend actions. Output only JSON matching the schema."
)


def _hash(*parts: Any) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


def response_schema(model: type[BaseModel]) -> dict:
    """Pydantic JSON schema -> Gemini responseSchema. Flat models only (no $defs), which is all we have."""
    def walk(node: dict) -> dict:
        out = {k: v for k, v in node.items() if k in SCHEMA_KEYS}
        if "type" in out:
            out["type"] = str(out["type"]).upper()
        if "properties" in out:
            out["properties"] = {name: walk(sub) for name, sub in out["properties"].items()}
        if "items" in out:
            out["items"] = walk(out["items"])
        return out
    return walk(model.model_json_schema())


class GeminiClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv(API_KEY_ENV, "")
        self.model = model or os.getenv("SENTINEL_AI_MODEL", DEFAULT_MODEL)
        # The key travels in a header, not the query string, so httpx's INFO request log never prints it.
        self._http: httpx.AsyncClient | None = None
        if self.api_key:
            self._http = httpx.AsyncClient(timeout=TIMEOUT_S, headers={"x-goog-api-key": self.api_key})
        self._cache: dict[str, dict] = {}
        self._window: deque[float] = deque()
        self.calls_used = 0
        self.failures = 0
        self.last_error: str | None = None

    # ------------------------------------------------------------------ status

    @property
    def live(self) -> bool:
        return self._http is not None

    def status(self) -> dict:
        self._trim_window()
        return {
            "live": self.live,
            "model": self.model,
            "calls_used": self.calls_used,
            "calls_last_minute": len(self._window),
            "cap_per_minute": CALLS_PER_MINUTE,
            "failures": self.failures,
            "last_error": self.last_error,
            "cache_size": len(self._cache),
            "key_env": API_KEY_ENV,
        }

    # ------------------------------------------------------------------ core call

    def _trim_window(self) -> None:
        cutoff = time.monotonic() - 60.0
        while self._window and self._window[0] < cutoff:
            self._window.popleft()

    def _capped(self) -> bool:
        self._trim_window()
        return len(self._window) >= CALLS_PER_MINUTE

    def _request_body(self, system: str, user: str, schema: type[BaseModel]) -> dict:
        generation: dict[str, Any] = {
            "responseMimeType": "application/json",
            "responseSchema": response_schema(schema),
            "maxOutputTokens": MAX_TOKENS,
            "temperature": 0,
        }
        if "2.5" in self.model:
            generation["thinkingConfig"] = {"thinkingBudget": 0}  # thinking tokens would eat the 8 s budget
        return {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": generation,
        }

    async def _structured(self, system: str, user: str, schema: type[BaseModel]) -> BaseModel | None:
        """One JSON-mode call validated against `schema`. None on any failure (caller falls back)."""
        if self._http is None:
            return None
        if self._capped():
            self.last_error = "rate cap"
            return None
        self._window.append(time.monotonic())
        self.calls_used += 1
        try:
            res = await self._http.post(f"{API_BASE}/{self.model}:generateContent",
                                        json=self._request_body(system, user, schema))
            if res.status_code != 200:
                raise RuntimeError(f"HTTP {res.status_code}: {res.text[:200]}")
            data = res.json()
            candidates = data.get("candidates") or []
            if not candidates:
                raise ValueError(f"no candidates (promptFeedback={data.get('promptFeedback')})")
            parts = candidates[0].get("content", {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts)
            if not text:
                raise ValueError(f"empty content (finishReason={candidates[0].get('finishReason')})")
            return schema.model_validate(json.loads(text))
        except ValidationError as exc:
            self.failures += 1
            self.last_error = f"schema: {exc.errors()[0].get('msg', 'invalid')}"
            log.warning("ai: model output failed schema validation: %s", self.last_error)
        except Exception as exc:  # noqa: BLE001 - the contract is: never raise, always fall back
            self.failures += 1
            self.last_error = f"{type(exc).__name__}: {str(exc)[:160]}"
            log.warning("ai: call failed, using rules: %s", self.last_error)
        return None

    def _cached(self, key: str) -> dict | None:
        hit = self._cache.get(key)
        return dict(hit, cached=True) if hit else None

    def _remember(self, key: str, value: dict) -> dict:
        if len(self._cache) >= CACHE_MAX:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = value
        return dict(value, cached=False)

    def _fallback_reason(self) -> str:
        if not self.live:
            return f"{API_KEY_ENV} not set"
        return self.last_error or "model call failed"

    # ------------------------------------------------------------------ features

    async def triage(self, text: str, reported_type: str | None = None, reported_count: int | None = None) -> dict:
        ruled = rules.triage(text, reported_type, reported_count)
        base = {"reported_type": reported_type, "reported_count": reported_count,
                "rules": {"type": ruled["type"], "count": ruled["count"], "urgency": ruled["urgency"]}}
        key = _hash("triage", self.model, text, reported_type, reported_count)
        hit = self._cached(key)
        if hit:
            return hit
        user = json.dumps({"report_text": text, "reporter_selected_type": reported_type,
                           "reporter_selected_count": reported_count}, ensure_ascii=False)
        out = await self._structured(SYSTEM_PROMPT, user, TriageOutput)
        if out is None:
            return dict(ruled, **base, fallback_reason=self._fallback_reason(), cached=False)
        result = dict(out.model_dump(), **base,
                      basis=f"{self.model} second opinion; keyword rules read {ruled['type']}/{ruled['count']}",
                      human_decides=rules.HUMAN_DECIDES)
        return self._remember(key, result)

    async def translate(self, text: str, target: str = "en") -> dict:
        language = rules.detect_language(text)
        key = _hash("translate", self.model, text, target)
        hit = self._cached(key)
        if hit:
            return hit
        if language == target:
            return {"text": text, "language_detected": language, "translated": False, "target": target,
                    "basis": "no-op: text already in target language", "cached": False}
        user = json.dumps({"text": text, "target_language": target}, ensure_ascii=False)
        out = await self._structured(TRANSLATE_SYSTEM, user, TranslateOutput)
        if out is None:
            return {"text": text, "language_detected": language, "translated": False, "target": target,
                    "basis": rules.FALLBACK_BASIS, "fallback_reason": self._fallback_reason(),
                    "note": "original text returned untranslated", "cached": False}
        result = {"text": out.text, "language_detected": out.language_detected, "translated": True, "target": target,
                  "basis": f"{self.model} translation; original text kept alongside", "original": text}
        return self._remember(key, result)

    async def brief(self, facts: dict, draft: str) -> dict:
        """`draft` is the deterministic template; the model may only rephrase it."""
        key = _hash("brief", self.model, facts)
        hit = self._cached(key)
        if hit:
            return hit
        user = json.dumps({"facts": facts, "draft": draft}, ensure_ascii=False, default=str)
        out = await self._structured(BRIEF_SYSTEM, user, BriefOutput)
        if out is None:
            return {"brief": draft, "basis": "fallback: template from live DB rows",
                    "fallback_reason": self._fallback_reason(), "cached": False}
        result = {"brief": out.brief, "draft": draft,
                  "basis": f"{self.model} rephrased a template; every fact is from live DB rows"}
        return self._remember(key, result)


client = GeminiClient()
