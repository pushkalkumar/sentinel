"""Claude second-opinion client. Rules decide; the model annotates. Never raises to callers.

Live path: anthropic SDK, forced tool use for a strict JSON schema, 8 s timeout, no SDK retries (the
deadline is the product requirement), in-memory cache keyed by input hash, 20 calls/min cap.
Any failure, or no ANTHROPIC_API_KEY, returns the deterministic keyword result with basis
'fallback: keyword rules'."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from collections import deque
from typing import Any

from pydantic import BaseModel, ValidationError

from app.ai import rules
from app.ai.schemas import (BRIEF_TOOL, TRANSLATE_TOOL, TRIAGE_TOOL, BriefOutput, TranslateOutput,
                            TriageOutput)

log = logging.getLogger("sentinel.ai")

DEFAULT_MODEL = "claude-haiku-4-5-20251001"
TIMEOUT_S = 8.0
MAX_TOKENS = 600
CALLS_PER_MINUTE = 20
CACHE_MAX = 512
API_KEY_ENV = "ANTHROPIC_API_KEY"

SYSTEM_PROMPT = (
    "You are a triage assistant for a school emergency console (Sentinel). You read short civilian reports "
    "and return a structured second opinion. You never dispatch, never instruct anyone to act, and never "
    "decide whether an alert opens or closes: sensor rules and human staff do that. "
    "Output only through the provided tool, matching its schema exactly. Do not invent facts that are not in "
    "the report; when the report does not say, use the neutral default (count 1, empty strings). "
    "In english_summary keep the reporter's exact words inside double quotes, then add at most one sentence "
    "of plain-English reading. Reports may be in any language; detect it and answer in English."
)
TRANSLATE_SYSTEM = (
    "You are a translation assistant for a school emergency console. Translate the reporter's text faithfully "
    "into the requested language. Add nothing, drop nothing, do not summarise. Output only through the tool."
)
BRIEF_SYSTEM = (
    "You are a situation-brief assistant for a school emergency console. You receive a list of facts pulled "
    "from the live database and a draft paragraph built from them. Rewrite the draft into one plain-English "
    "paragraph a responder can read in ten seconds. Use only the facts given; never add numbers, places or "
    "causes that are not listed. You never dispatch or recommend actions. Output only through the tool."
)


def _hash(*parts: Any) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


class ClaudeClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv(API_KEY_ENV, "")
        self.model = model or os.getenv("SENTINEL_AI_MODEL", DEFAULT_MODEL)
        self._sdk = None
        if self.api_key:
            import anthropic  # imported lazily so tests without the key never need network-capable objects
            self._sdk = anthropic.AsyncAnthropic(api_key=self.api_key, timeout=TIMEOUT_S, max_retries=0)
        self._cache: dict[str, dict] = {}
        self._window: deque[float] = deque()
        self.calls_used = 0
        self.failures = 0
        self.last_error: str | None = None

    # ------------------------------------------------------------------ status

    @property
    def live(self) -> bool:
        return self._sdk is not None

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

    async def _structured(self, system: str, user: str, tool: dict, schema: type[BaseModel]) -> BaseModel | None:
        """One forced-tool call validated against `schema`. None on any failure (caller falls back)."""
        if self._sdk is None:
            return None
        if self._capped():
            self.last_error = "rate cap"
            return None
        self._window.append(time.monotonic())
        self.calls_used += 1
        try:
            response = await self._sdk.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user}],
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError(f"no tool_use block (stop_reason={response.stop_reason})")
            return schema.model_validate(block.input)
        except ValidationError as exc:
            self.failures += 1
            self.last_error = f"schema: {exc.errors()[0].get('msg', 'invalid')}"
            log.warning("ai: model output failed schema validation: %s", self.last_error)
        except Exception as exc:  # noqa: BLE001 - the contract is: never raise, always fall back
            self.failures += 1
            self.last_error = f"{type(exc).__name__}: {str(exc)[:120]}"
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
        out = await self._structured(SYSTEM_PROMPT, user, TRIAGE_TOOL, TriageOutput)
        if out is None:
            return dict(ruled, **base, fallback_reason=self._fallback_reason(), cached=False)
        result = dict(out.model_dump(), **base,
                      basis=f"{self.model} second opinion via tool use; keyword rules read {ruled['type']}/{ruled['count']}",
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
        out = await self._structured(TRANSLATE_SYSTEM, user, TRANSLATE_TOOL, TranslateOutput)
        if out is None:
            return {"text": text, "language_detected": language, "translated": False, "target": target,
                    "basis": rules.FALLBACK_BASIS, "fallback_reason": self._fallback_reason(),
                    "note": "original text returned untranslated", "cached": False}
        result = {"text": out.text, "language_detected": out.language_detected, "translated": True, "target": target,
                  "basis": f"{self.model} via tool use; original text kept alongside", "original": text}
        return self._remember(key, result)

    async def brief(self, facts: dict, draft: str) -> dict:
        """`draft` is the deterministic template; the model may only rephrase it."""
        key = _hash("brief", self.model, facts)
        hit = self._cached(key)
        if hit:
            return hit
        user = json.dumps({"facts": facts, "draft": draft}, ensure_ascii=False, default=str)
        out = await self._structured(BRIEF_SYSTEM, user, BRIEF_TOOL, BriefOutput)
        if out is None:
            return {"brief": draft, "basis": "fallback: template from live DB rows",
                    "fallback_reason": self._fallback_reason(), "cached": False}
        result = {"brief": out.brief, "draft": draft,
                  "basis": f"{self.model} rephrased a template; every fact is from live DB rows"}
        return self._remember(key, result)


client = ClaudeClient()
