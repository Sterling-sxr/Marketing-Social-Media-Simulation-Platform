from __future__ import annotations

from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services.course_material_service import (
    delete_course_material,
    list_course_materials,
    upload_course_material,
)


# Purpose: Orchestrate `_ensure_authenticated` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


@csrf_exempt
# Purpose: Orchestrate `course_materials_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_materials_view(request: HttpRequest, course_id: int) -> JsonResponse:
    """Execute the `course_materials_view` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        category = request.GET.get("category", "").strip() or None
        try:
            items = list_course_materials(request.user, course_id, category=category)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"items": items})

    if request.method == "POST":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"error": "No file provided."}, status=400)

        title = request.POST.get("title", "").strip()
        description = request.POST.get("description", "").strip()
        category = request.POST.get("category", "other").strip()

        try:
            material = upload_course_material(
                user=request.user,
                course_id=course_id,
                title=title,
                description=description,
                category=category,
                uploaded_file=uploaded_file,
            )
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except (ValidationError, ValueError) as exc:
            msg = exc.message if hasattr(exc, "message") else str(exc)
            return JsonResponse({"error": msg}, status=400)

        return JsonResponse({"material": material}, status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
# Purpose: Orchestrate `course_material_detail_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_material_detail_view(
    request: HttpRequest, course_id: int, material_id: int
) -> JsonResponse:
    """Execute the `course_material_detail_view` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "DELETE":
        try:
            delete_course_material(request.user, course_id, material_id)
        except PermissionError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"deleted": True})

    return JsonResponse({"error": "Method not allowed"}, status=405)
