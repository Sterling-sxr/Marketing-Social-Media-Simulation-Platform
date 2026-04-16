from __future__ import annotations

from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services.course_material_service import (
    delete_course_material,
    list_course_materials,
    upload_course_material,
)


# Purpose: Handle the `_ensure_authenticated` workflow and keep behavior predictable.
# Details: Validate incoming data, call dependent services, and return a stable response.
def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


@csrf_exempt
# Purpose: Handle the `course_materials_view` workflow and keep behavior predictable.
# Details: Validate incoming data, call dependent services, and return a stable response.
def course_materials_view(request: HttpRequest, course_id: int) -> JsonResponse:
    """Handle the `course_materials_view` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
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
# Purpose: Handle the `course_material_detail_view` workflow and keep behavior predictable.
# Details: Validate incoming data, call dependent services, and return a stable response.
def course_material_detail_view(
    request: HttpRequest, course_id: int, material_id: int
) -> JsonResponse:
    """Handle the `course_material_detail_view` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
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
