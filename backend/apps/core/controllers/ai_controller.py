from __future__ import annotations

import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import generate_ai_analysis, generate_tutor_response
from .profile_controller import _ensure_authenticated


@csrf_exempt
# Purpose: Orchestrate `ai_analyze` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def ai_analyze(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    context = (payload.get("context") or "").strip()
    data = payload.get("payload") or {}
    if not context:
        return JsonResponse({"error": "Field `context` is required."}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Field `payload` must be an object."}, status=400)

    try:
        summary = generate_ai_analysis(context=context, payload=data)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    except Exception:  # pragma: no cover - safety
        return JsonResponse({"error": "Failed to generate analysis."}, status=500)

    return JsonResponse({"summary": summary})


@csrf_exempt
# Purpose: Orchestrate `ai_tutor` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def ai_tutor(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    question = (payload.get("question") or "").strip()
    history = payload.get("history") or []

    if not question:
        return JsonResponse({"error": "Field `question` is required."}, status=400)
    if len(question) > 2000:
        return JsonResponse({"error": "Question too long (max 2000 characters)."}, status=400)
    if not isinstance(history, list):
        return JsonResponse({"error": "Field `history` must be an array."}, status=400)

    try:
        result = generate_tutor_response(question=question, history=history)
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    except Exception:
        return JsonResponse({"error": "Failed to generate response."}, status=500)

    return JsonResponse(result)


__all__ = ["ai_analyze", "ai_tutor"]
