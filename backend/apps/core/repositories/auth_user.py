"""Module summary: this module groups related logic and clarifies design intent."""
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
    """Handle the `get_by_email` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    return UserModel.objects.filter(email__iexact=email).first()


def get_by_username(username: str) -> Optional[AbstractBaseUser]:
    """Handle the `get_by_username` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    return UserModel.objects.filter(username__iexact=username).first()


def create_user(*, username: str, email: str, password: str) -> UserCreationResult:
    """Handle the `create_user` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    try:
        user = UserModel.objects.create_user(
            username=username.lower(),
            email=email.lower(),
            password=password,
        )
        return UserCreationResult(user=user, created=True)
    except IntegrityError:
        # Context: This block prepares shared values used by the request branches below.
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
