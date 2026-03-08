from __future__ import annotations

import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    CourseAINotFoundError,
    create_course_ai_user,
    delete_course_ai_user,
    get_course_ai_user,
    import_course_ai_users,
    list_course_ai_users,
    update_course_ai_user,
)


def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


@csrf_exempt
def course_ai_users(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        keyword = (request.GET.get("q") or "").strip()
        try:
            data = list_course_ai_users(user=request.user, course_id=course_id, keyword=keyword or None)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse(data)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

        try:
            item = create_course_ai_user(user=request.user, course_id=course_id, payload=payload)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        return JsonResponse({"item": item}, status=201)

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "GET, POST, OPTIONS"
        return response

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def course_ai_user_detail(request: HttpRequest, course_id: int, ai_user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        try:
            item = get_course_ai_user(user=request.user, course_id=course_id, ai_user_id=ai_user_id)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except (ValueError, CourseAINotFoundError) as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"item": item})

    if request.method in {"PUT", "PATCH"}:
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Request body must be valid JSON."}, status=400)
        try:
            item = update_course_ai_user(
                user=request.user,
                course_id=course_id,
                ai_user_id=ai_user_id,
                payload=payload,
            )
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseAINotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        return JsonResponse({"item": item})

    if request.method == "DELETE":
        try:
            delete_course_ai_user(user=request.user, course_id=course_id, ai_user_id=ai_user_id)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseAINotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({}, status=204)

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "GET, PUT, PATCH, DELETE, OPTIONS"
        return response

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def course_ai_users_import(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    upload = request.FILES.get("file")
    if not upload:
        return JsonResponse({"error": "Please upload a CSV file."}, status=400)

    try:
        report = import_course_ai_users(user=request.user, course_id=course_id, file_bytes=upload.read())
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    return JsonResponse(report)
