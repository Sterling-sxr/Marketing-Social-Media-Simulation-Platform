from __future__ import annotations

from django.http import HttpRequest


def resolve_user_from_request(request: HttpRequest) -> str | None:
    """Execute the `resolve_user_from_request` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    user = request.GET.get("user") or request.headers.get("X-User")
    return user.strip() if user else None


__all__ = ["resolve_user_from_request"]
