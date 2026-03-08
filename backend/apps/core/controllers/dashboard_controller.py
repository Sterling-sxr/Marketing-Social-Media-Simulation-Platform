from __future__ import annotations

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    get_admin_dashboard,
    get_course_dashboard,
    get_course_hashtag_dashboard,
    get_course_student_dashboard,
)
from .course_controller import _ensure_authenticated


@csrf_exempt
def dashboard_summary(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = get_admin_dashboard(user=request.user)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)

    return JsonResponse({"summary": data})


@csrf_exempt
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
