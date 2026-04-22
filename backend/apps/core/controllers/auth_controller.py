from __future__ import annotations

import json

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    AuthenticationError,
    EmailThrottleError,
    PasswordResetCodeError,
    PasswordResetError,
    PasswordResetThrottleError,
    RegistrationError,
    VerificationCodeError,
    authenticate_user,
    complete_registration,
    confirm_password_reset,
    logout_user,
    needs_profile,
    request_password_reset,
    request_verification_code,
    verify_password_reset_code,
    verify_registration_code,
)


# Purpose: Orchestrate `_parse_json` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def _parse_json(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode())
    except json.JSONDecodeError:
        raise ValueError("Request body must be valid JSON.") from None


@csrf_exempt
# Purpose: Orchestrate `send_registration_code` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def send_registration_code(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    email = payload.get("email") or ""
    role = payload.get("role") or "student"

    try:
        verification = request_verification_code(email, role=role)
    except EmailThrottleError as exc:
        return JsonResponse({"error": str(exc)}, status=429)
    except RegistrationError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    response = {"email": verification.email}
    if settings.DEBUG:
        response["dev_code"] = verification.code

    return JsonResponse(response, status=201)


@csrf_exempt
# Purpose: Orchestrate `verify_registration_code_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def verify_registration_code_view(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    email = payload.get("email") or ""
    code = payload.get("code") or ""

    try:
        verify_registration_code(email=email, code=code)
    except VerificationCodeError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except RegistrationError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"verified": True})


@csrf_exempt
# Purpose: Orchestrate `complete_registration_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def complete_registration_view(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    email = payload.get("email") or ""
    password = payload.get("password") or ""
    role = payload.get("role") or "student"

    try:
        result = complete_registration(email=email, password=password, role=role)
    except VerificationCodeError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except RegistrationError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    user = result.user
    return JsonResponse(
        {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            }
        },
        status=201,
    )


@csrf_exempt
# Purpose: Orchestrate `login_user` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def login_user(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    email = payload.get("email") or ""
    password = payload.get("password") or ""

    try:
        auth_user = authenticate_user(request, email=email, password=password)
    except AuthenticationError as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    profile_required = needs_profile(request.user)
    return JsonResponse(
        {
            "user": {
                "id": auth_user.id,
                "username": auth_user.username,
                "email": auth_user.email,
                "is_superuser": auth_user.is_superuser,
                "is_staff": auth_user.is_staff,
            },
            "needs_profile": profile_required,
        }
    )


# Purpose: Orchestrate `check_auth_status` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def check_auth_status(request: HttpRequest) -> JsonResponse:
    """Execute the `check_auth_status` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=200)
    
    profile_required = needs_profile(request.user)
    return JsonResponse(
        {
            "authenticated": True,
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "is_superuser": request.user.is_superuser,
                "is_staff": request.user.is_staff,
            },
            "needs_profile": profile_required,
        }
    )


@csrf_exempt
# Purpose: Orchestrate `logout_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def logout_view(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    logout_user(request)
    return JsonResponse({"success": True})


@csrf_exempt
# Purpose: Orchestrate `send_password_reset_code` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def send_password_reset_code(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    email = payload.get("email") or ""

    try:
        verification = request_password_reset(email)
    except PasswordResetThrottleError as exc:
        return JsonResponse({"error": str(exc)}, status=429)
    except PasswordResetError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    response = {"email": verification.email}
    if settings.DEBUG:
        response["dev_code"] = verification.code

    return JsonResponse(response, status=201)


@csrf_exempt
# Purpose: Orchestrate `confirm_password_reset_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def confirm_password_reset_view(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    email = payload.get("email") or ""
    code = payload.get("code") or ""

    try:
        verify_password_reset_code(email=email, code=code)
    except PasswordResetCodeError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except PasswordResetError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"verified": True})


@csrf_exempt
# Purpose: Orchestrate `complete_password_reset_view` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def complete_password_reset_view(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = _parse_json(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    email = payload.get("email") or ""
    new_password = payload.get("password") or ""

    try:
        user = confirm_password_reset(email=email, new_password=new_password)
    except PasswordResetCodeError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except PasswordResetError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse(
        {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            }
        }
    )


__all__ = [
    "send_registration_code",
    "verify_registration_code_view",
    "complete_registration_view",
    "login_user",
    "logout_view",
    "check_auth_status",
    "send_password_reset_code",
    "confirm_password_reset_view",
    "complete_password_reset_view",
]
