from __future__ import annotations

import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    CourseAINotFoundError,
    commit_generated_personas,
    commit_guided_personas,
    create_course_ai_user,
    delete_course_ai_user,
    get_course_ai_user,
    import_course_ai_users,
    list_course_ai_users,
    preview_generated_personas,
    preview_guided_personas,
    get_generated_preview_task,
    start_generated_preview_task,
    update_course_ai_user,
)


# Purpose: Orchestrate `_ensure_authenticated` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


@csrf_exempt
# Purpose: Orchestrate `course_ai_users` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
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
# Purpose: Orchestrate `course_ai_user_detail` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
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
# Purpose: Orchestrate `course_ai_users_import` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
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


# Purpose: Orchestrate `_load_json_body` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def _load_json_body(request: HttpRequest) -> tuple[dict, JsonResponse | None]:
    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return {}, JsonResponse({"error": "Request body must be valid JSON."}, status=400)
    if not isinstance(payload, dict):
        return {}, JsonResponse({"error": "Request body must be a JSON object."}, status=400)
    return payload, None


@csrf_exempt
# Purpose: Orchestrate `course_ai_users_guided_preview` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_ai_users_guided_preview(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload, error = _load_json_body(request)
    if error:
        return error

    try:
        result = preview_guided_personas(user=request.user, course_id=course_id, payload=payload)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    return JsonResponse(result)


@csrf_exempt
# Purpose: Orchestrate `course_ai_users_guided_commit` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_ai_users_guided_commit(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload, error = _load_json_body(request)
    if error:
        return error

    try:
        result = commit_guided_personas(user=request.user, course_id=course_id, payload=payload)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    return JsonResponse(result, status=201)


@csrf_exempt
# Purpose: Orchestrate `course_ai_users_generate_preview` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_ai_users_generate_preview(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload, error = _load_json_body(request)
    if error:
        return error

    try:
        result = preview_generated_personas(user=request.user, course_id=course_id, payload=payload)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    return JsonResponse(result)


@csrf_exempt
def course_ai_users_generate_preview_async_start(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload, error = _load_json_body(request)
    if error:
        return error

    try:
        task = start_generated_preview_task(user=request.user, course_id=course_id, payload=payload)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    return JsonResponse(task, status=202)


def course_ai_users_generate_preview_task_status(
    request: HttpRequest, course_id: int, task_id: str
) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        task = get_generated_preview_task(user=request.user, course_id=course_id, task_id=task_id)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=404)
    status = task.get("status")
    http_status = 202 if status in {"pending", "running"} else 200
    return JsonResponse(task, status=http_status)


@csrf_exempt
# Purpose: Orchestrate `course_ai_users_generate_commit` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_ai_users_generate_commit(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload, error = _load_json_body(request)
    if error:
        return error

    try:
        result = commit_generated_personas(user=request.user, course_id=course_id, payload=payload)
    except PermissionError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    return JsonResponse(result, status=201)
