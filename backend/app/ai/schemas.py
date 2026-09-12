"""Pydantic shapes for /api/ai (request bodies and the model's tool-use output)."""
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
    """What the model must return through the `report_triage` tool. Validated before it is trusted."""
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


TRIAGE_TOOL = {
    "name": "report_triage",
    "description": "Return the structured triage reading for one civilian report.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["type", "count", "people_detail", "hazards", "access_notes", "urgency",
                     "language_detected", "english_summary"],
        "properties": {
            "type": {"type": "string", "enum": list(IncidentType.__args__)},
            "count": {"type": "integer", "description": "People affected. 1 if the text does not say."},
            "people_detail": {"type": "string", "description": "Who: children, adults, injured, etc. Empty if unknown."},
            "hazards": {"type": "array", "items": {"type": "string"}},
            "access_notes": {"type": "string", "description": "Doors, stairs, blocked exits, room numbers."},
            "urgency": {"type": "integer", "description": "1 = life at risk now, 4 = informational."},
            "language_detected": {"type": "string", "description": "ISO 639-1 code of the reporter's text."},
            "english_summary": {"type": "string",
                                "description": "One or two sentences. Quote the reporter's exact words in double quotes."},
        },
    },
}

TRANSLATE_TOOL = {
    "name": "report_translation",
    "description": "Return the translation of the reporter's text.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["text", "language_detected"],
        "properties": {
            "text": {"type": "string", "description": "Faithful translation. Do not add or remove facts."},
            "language_detected": {"type": "string", "description": "ISO 639-1 code of the source text."},
        },
    },
}

BRIEF_TOOL = {
    "name": "report_brief",
    "description": "Return the one-paragraph situation brief.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["brief"],
        "properties": {"brief": {"type": "string", "description": "One plain-English paragraph, facts only."}},
    },
}
