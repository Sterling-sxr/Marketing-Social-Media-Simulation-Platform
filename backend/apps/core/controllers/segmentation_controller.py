from __future__ import annotations

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    get_admin_course_segmentation,
    get_admin_post_segmentation,
)
from .course_post_controller import _ensure_authenticated


@csrf_exempt
# Purpose: Orchestrate `dashboard_course_segmentation` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def dashboard_course_segmentation(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = get_admin_course_segmentation(
            user=request.user,
            course_id=course_id,
            lens=request.GET.get("lens"),
        )
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"segmentation": data})


@csrf_exempt
# Purpose: Orchestrate `admin_course_post_segmentation` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def admin_course_post_segmentation(request: HttpRequest, course_id: int, post_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    compare_post_id = request.GET.get("compare_post_id")
    try:
        parsed_compare_post_id = int(compare_post_id) if compare_post_id else None
    except (TypeError, ValueError):
        return JsonResponse({"error": "compare_post_id must be numeric."}, status=400)

    try:
        data = get_admin_post_segmentation(
            user=request.user,
            course_id=course_id,
            post_id=post_id,
            lens=request.GET.get("lens"),
            compare_post_id=parsed_compare_post_id,
        )
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"segmentation": data})


__all__ = [
    "dashboard_course_segmentation",
    "admin_course_post_segmentation",
]
