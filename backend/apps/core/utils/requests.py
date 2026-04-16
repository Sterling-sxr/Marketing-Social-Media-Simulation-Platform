from __future__ import annotations

from django.http import HttpRequest


def resolve_user_from_request(request: HttpRequest) -> str | None:
    """Function note: resolve_user_from_request handles this backend operation."""
    user = request.GET.get("user") or request.headers.get("X-User")
    return user.strip() if user else None


__all__ = ["resolve_user_from_request"]
