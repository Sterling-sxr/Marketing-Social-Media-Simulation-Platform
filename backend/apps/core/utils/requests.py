from __future__ import annotations

from django.http import HttpRequest


def resolve_user_from_request(request: HttpRequest) -> str | None:
    """Extract user identifier from query params or headers."""
    user = request.GET.get("user") or request.headers.get("X-User")
    return user.strip() if user else None


__all__ = ["resolve_user_from_request"]
