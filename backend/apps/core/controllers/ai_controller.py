from __future__ import annotations

import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import generate_ai_analysis
from .profile_controller import _ensure_authenticated


@csrf_exempt
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


__all__ = ["ai_analyze"]
