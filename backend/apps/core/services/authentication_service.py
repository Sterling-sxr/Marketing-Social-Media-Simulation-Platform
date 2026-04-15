"""Authentication helpers for login/logout."""
from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import authenticate, login, logout

from ..repositories import get_by_email
from .verification_helpers import normalise_email


class AuthenticationError(Exception):
    """Base error for authentication failures."""


@dataclass
class AuthenticatedUser:
    id: int
    username: str
    email: str
    is_superuser: bool
    is_staff: bool


def authenticate_user(request, *, email: str, password: str) -> AuthenticatedUser:
    normalised_email = normalise_email(email)
    user = get_by_email(normalised_email)
    if not user:
        raise AuthenticationError("Incorrect email or password.")

    if not user.is_active:
        raise AuthenticationError("This account has been deactivated. Please contact an administrator.")

    auth_user = authenticate(request, username=user.username, password=password)
    if auth_user is None:
        raise AuthenticationError("Incorrect email or password.")

    login(request, auth_user)

    return AuthenticatedUser(
        id=auth_user.id,
        username=auth_user.username,
        email=auth_user.email,
        is_superuser=bool(getattr(auth_user, "is_superuser", False)),
        is_staff=bool(getattr(auth_user, "is_staff", False)),
    )


def logout_user(request) -> None:
    logout(request)


__all__ = ["AuthenticationError", "AuthenticatedUser", "authenticate_user", "logout_user"]
