"""Repository helpers around Django's built-in auth_user table."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from django.db import IntegrityError

UserModel = get_user_model()


@dataclass
class UserCreationResult:
    user: AbstractBaseUser
    created: bool


def get_by_email(email: str) -> Optional[AbstractBaseUser]:
    """Fetch a user by email ignoring casing."""
    return UserModel.objects.filter(email__iexact=email).first()


def get_by_username(username: str) -> Optional[AbstractBaseUser]:
    """Fetch a user by username (zid)."""
    return UserModel.objects.filter(username__iexact=username).first()


def create_user(*, username: str, email: str, password: str) -> UserCreationResult:
    """Create a user; returns existing user if username collision occurs."""
    try:
        user = UserModel.objects.create_user(
            username=username.lower(),
            email=email.lower(),
            password=password,
        )
        return UserCreationResult(user=user, created=True)
    except IntegrityError:
        # Re-fetch in case of race, return as not created.
        existing = get_by_username(username)
        if existing is None:
            raise
        return UserCreationResult(user=existing, created=False)


__all__ = [
    "get_by_email",
    "get_by_username",
    "create_user",
    "UserCreationResult",
]
