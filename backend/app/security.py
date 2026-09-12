"""Signed tokens and demo hashing (CONTRACT §2.1, §1.3)."""
from __future__ import annotations

import hashlib

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

_serializer = URLSafeTimedSerializer(secret_key=settings.secret, salt="sentinel-auth")


def sign_token(payload: dict) -> str:
    return _serializer.dumps(payload)


def verify_token(token: str) -> dict | None:
    try:
        data = _serializer.loads(token, max_age=settings.token_max_age_s)
    except (BadSignature, SignatureExpired, ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()
