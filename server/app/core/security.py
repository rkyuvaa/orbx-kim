from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

_ph = PasswordHasher()

# Dummy Argon2id hash for constant-time comparison against nonexistent accounts
DUMMY_ARGON2_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9/U+8xP6N7Q4O6k3J+5w8A"


def hash_password(password: str) -> str:
    if not password or not isinstance(password, str):
        raise ValueError("Password must be a non-empty string")
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Secure password verification using Argon2.
    Strictly validates input types, hash formats, and never allows plaintext matching or exception pass-through.
    """
    if not password or not isinstance(password, str) or not password.strip():
        return False
    if not password_hash or not isinstance(password_hash, str) or len(password_hash) < 20:
        return False

    # Never compare plaintext passwords directly with stored strings
    if password == password_hash:
        return False

    # Verify standard Argon2 hash prefix
    if not (
        password_hash.startswith("$argon2id$")
        or password_hash.startswith("$argon2i$")
        or password_hash.startswith("$argon2d$")
    ):
        return False

    try:
        return _ph.verify(password_hash, password)
    except Exception:
        return False


def create_token(subject: str, token_type: str, expires_delta: timedelta, **extra: Any) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": jwt.utils.base64url_encode(now.isoformat().encode()).decode(),
    }
    payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(subject: str, role: str) -> str:
    return create_token(
        subject,
        "access",
        timedelta(minutes=settings.access_token_minutes),
        role=role,
    )


def create_refresh_token(subject: str) -> str:
    return create_token(subject, "refresh", timedelta(hours=settings.refresh_token_hours))


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    if not token or not isinstance(token, str):
        raise jwt.InvalidTokenError("Token is empty or invalid format")
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    if not payload.get("sub"):
        raise jwt.InvalidTokenError("Token subject is missing")
    return payload
