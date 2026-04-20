from __future__ import annotations

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    get_course_dashboard,
    get_course_hashtag_dashboard,
    get_course_student_dashboard,
    refresh_dashboard_snapshot,
)
from .course_controller import _ensure_authenticated


@csrf_exempt
# Purpose: Orchestrate `dashboard_summary` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def dashboard_summary(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        range_days = int(request.GET.get("range_days", "7"))
        if range_days <= 0 or range_days > 365:
            raise ValueError("range_days must be between 1 and 365.")
        data = refresh_dashboard_snapshot(user=request.user, range_days=range_days)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)

    return JsonResponse({"summary": data})


@csrf_exempt
# Purpose: Orchestrate `dashboard_course_detail` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def dashboard_course_detail(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = get_course_dashboard(user=request.user, course_id=course_id)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)

    return JsonResponse({"course": data})


@csrf_exempt
# Purpose: Orchestrate `dashboard_course_hashtag_detail` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def dashboard_course_hashtag_detail(
    request: HttpRequest, course_id: int, hashtag: str
) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = get_course_hashtag_dashboard(
            user=request.user,
            course_id=course_id,
            hashtag=hashtag,
        )
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"hashtag": data})


@csrf_exempt
# Purpose: Orchestrate `dashboard_course_student_detail` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def dashboard_course_student_detail(
    request: HttpRequest, course_id: int, student_id: int
) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = get_course_student_dashboard(
            user=request.user,
            course_id=course_id,
            student_id=student_id,
        )
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=404)

    return JsonResponse({"student": data})


__all__ = [
    "dashboard_summary",
    "dashboard_course_detail",
    "dashboard_course_hashtag_detail",
    "dashboard_course_student_detail",
]
