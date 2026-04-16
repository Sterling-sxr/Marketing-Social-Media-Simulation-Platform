"""Module note: auth_user backend module."""
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
    """Function note: get_by_email handles this backend operation."""
    return UserModel.objects.filter(email__iexact=email).first()


def get_by_username(username: str) -> Optional[AbstractBaseUser]:
    """Function note: get_by_username handles this backend operation."""
    return UserModel.objects.filter(username__iexact=username).first()


def create_user(*, username: str, email: str, password: str) -> UserCreationResult:
    """Function note: create_user handles this backend operation."""
    try:
        user = UserModel.objects.create_user(
            username=username.lower(),
            email=email.lower(),
            password=password,
        )
        return UserCreationResult(user=user, created=True)
    except IntegrityError:
        # Section note: explains the purpose of this backend block.
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
