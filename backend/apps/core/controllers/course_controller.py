from __future__ import annotations

import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..repositories import CourseMemberRepository
from ..services import (
    create_course,
    get_course_profile,
    join_course_by_code,
    list_courses_for_user,
    list_managed_courses,
    save_course_profile,
    update_course,
)


def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


def list_courses(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    data = list_courses_for_user(request.user)
    return JsonResponse(data)


@csrf_exempt
def join_course(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    join_code = payload.get("join_code") or ""
    try:
        membership = join_course_by_code(user=request.user, join_code=join_code)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse(
        {
            "joined": {
                "course_id": membership.course_id,
                "role": membership.role,
            }
        },
        status=201,
    )


__all__ = [
    "list_courses",
    "join_course",
    "create_course_view",
    "list_managed_courses_view",
    "list_user_courses_view",
    "update_course_view",
    "course_profile_view",
]


@csrf_exempt
def create_course_view(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    try:
        item = create_course(
            user=request.user,
            course_code=payload.get("course_code") or payload.get("courseCode") or "",
            course_name=payload.get("course_name") or payload.get("courseName") or "",
            term=payload.get("term") or "",
            start_date=payload.get("start_date") or payload.get("startDate"),
            end_date=payload.get("end_date") or payload.get("endDate"),
        )
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"course": item}, status=201)


def list_managed_courses_view(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    items = list_managed_courses(user=request.user)
    return JsonResponse({"items": items})


def list_user_courses_view(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    is_admin = bool(getattr(request.user, "is_superuser", False) or getattr(request.user, "is_staff", False))
    if not is_admin and request.user.id != user_id:
        return JsonResponse({"error": "Forbidden"}, status=403)

    memberships = (
        CourseMemberRepository.model.objects.filter(user_id=user_id)
        .select_related("course")
        .order_by("course__course_code")
    )
    items = []
    for member in memberships:
        course = member.course
        if not course:
            continue
        items.append(
            {
                "id": course.id,
                "name": course.name,
                "course_code": course.course_code,
                "term": course.term,
                "role": member.role,
            }
        )
    return JsonResponse({"items": items})


@csrf_exempt
def update_course_view(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method not in {"PUT", "PATCH"}:
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    try:
        course = update_course(
            user=request.user,
            course_id=course_id,
            course_code=payload.get("course_code") or payload.get("courseCode") or "",
            course_name=payload.get("course_name") or payload.get("courseName") or "",
            term=payload.get("term") or "",
            start_date=payload.get("start_date") or payload.get("startDate"),
            end_date=payload.get("end_date") or payload.get("endDate"),
        )
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"course": course})


@csrf_exempt
def course_profile_view(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        try:
            data = get_course_profile(user=request.user, course_id=course_id)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse(data)

    if request.method not in {"POST", "PUT"}:
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    try:
        data = save_course_profile(user=request.user, course_id=course_id, payload=payload)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=404)

    return JsonResponse(data)
