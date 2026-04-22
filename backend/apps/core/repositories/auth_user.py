"""Module summary: Collect related domain logic and document the intended design boundaries."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from django.db import IntegrityError

UserModel = get_user_model()


@dataclass
class UserCreationResult:
    user: AbstractBaseUser
    created: bool


def get_by_email(email: str) -> Optional[AbstractBaseUser]:
    """Execute the `get_by_email` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return UserModel.objects.filter(email__iexact=email).first()


def get_by_username(username: str) -> Optional[AbstractBaseUser]:
    """Execute the `get_by_username` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return UserModel.objects.filter(username__iexact=username).first()


def create_user(
    *,
    username: str,
    email: str,
    password: str,
    role: Literal["student", "teacher"] = "student",
) -> UserCreationResult:
    """Execute the `create_user` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    try:
        user = UserModel.objects.create_user(
            username=username.lower(),
            email=email.lower(),
            password=password,
            is_staff=(role == "teacher"),
            is_superuser=(role == "teacher"),
        )
        return UserCreationResult(user=user, created=True)
    except IntegrityError:
        # Context: Compute shared values once so all branches use the same normalized inputs.
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
