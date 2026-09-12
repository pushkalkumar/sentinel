"""Pydantic shapes for /api/ai (request bodies and the model's JSON output; Gemini responseSchema is derived from these)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

IncidentType = Literal["fire", "trapped", "medical", "water", "other", "safe"]


class TriageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    type: Optional[IncidentType] = None
    count: Optional[int] = Field(default=None, ge=1, le=500)


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    target: str = Field(default="en", min_length=2, max_length=5, pattern=r"^[a-z]{2}(-[A-Za-z]{2})?$")


class TriageOutput(BaseModel):
    """What the model must return as JSON. Validated before it is trusted."""
    type: IncidentType
    count: int = Field(ge=1, le=500)
    people_detail: str = Field(default="", max_length=300)
    hazards: list[str] = Field(default_factory=list, max_length=10)
    access_notes: str = Field(default="", max_length=300)
    urgency: int = Field(ge=1, le=4)
    language_detected: str = Field(min_length=2, max_length=8)
    english_summary: str = Field(min_length=1, max_length=600)


class TranslateOutput(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    language_detected: str = Field(min_length=2, max_length=8)


class BriefOutput(BaseModel):
    brief: str = Field(min_length=1, max_length=1500)
