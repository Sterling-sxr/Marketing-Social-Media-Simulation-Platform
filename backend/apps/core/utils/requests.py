from __future__ import annotations

from django.http import HttpRequest


def resolve_user_from_request(request: HttpRequest) -> str | None:
    """Function summary: resolve_user_from_request executes this unit of backend logic."""
    user = request.GET.get("user") or request.headers.get("X-User")
    return user.strip() if user else None


__all__ = ["resolve_user_from_request"]
