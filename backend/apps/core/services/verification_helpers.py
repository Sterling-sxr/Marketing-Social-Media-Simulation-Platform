"""Shared helpers for email verification flows."""
from __future__ import annotations

import random
import re
from typing import Optional

from django.core.cache import cache

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+edu\.au$", re.IGNORECASE)
CODE_TTL_SECONDS = 5 * 60
THROTTLE_SECONDS = 60


def _verified_key(purpose: str, email: str) -> str:
    return f"verification:{purpose}:verified:{email}"


def normalise_email(email: str) -> str:
    return (email or "").strip().lower()


def generate_code() -> str:
    return f"{random.randint(0, 9999):04d}"


def _code_key(purpose: str, email: str) -> str:
    return f"verification:{purpose}:code:{email}"


def _throttle_key(purpose: str, email: str) -> str:
    return f"verification:{purpose}:throttle:{email}"


def store_code(*, purpose: str, email: str, code: str) -> None:
    cache.set(_code_key(purpose, email), code, CODE_TTL_SECONDS)
    cache.set(_throttle_key(purpose, email), True, THROTTLE_SECONDS)


def get_code(*, purpose: str, email: str) -> Optional[str]:
    return cache.get(_code_key(purpose, email))


def clear_state(*, purpose: str, email: str) -> None:
    cache.delete(_code_key(purpose, email))
    cache.delete(_throttle_key(purpose, email))


def is_throttled(*, purpose: str, email: str) -> bool:
    return bool(cache.get(_throttle_key(purpose, email)))


def mark_verified(*, purpose: str, email: str) -> None:
    cache.set(_verified_key(purpose, email), True, CODE_TTL_SECONDS)


def is_verified(*, purpose: str, email: str) -> bool:
    return bool(cache.get(_verified_key(purpose, email)))


def clear_verified(*, purpose: str, email: str) -> None:
    cache.delete(_verified_key(purpose, email))


__all__ = [
    "EMAIL_REGEX",
    "CODE_TTL_SECONDS",
    "THROTTLE_SECONDS",
    "normalise_email",
    "generate_code",
    "store_code",
    "get_code",
    "clear_state",
    "is_throttled",
    "mark_verified",
    "is_verified",
    "clear_verified",
]
