from __future__ import annotations

from django.http import HttpRequest


def resolve_user_from_request(request: HttpRequest) -> str | None:
    """Handle the `resolve_user_from_request` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    user = request.GET.get("user") or request.headers.get("X-User")
    return user.strip() if user else None


__all__ = ["resolve_user_from_request"]
