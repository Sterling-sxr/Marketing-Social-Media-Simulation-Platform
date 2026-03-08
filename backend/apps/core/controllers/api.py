from __future__ import annotations

import json

from django.http import (
    HttpRequest,
    HttpResponseBadRequest,
    HttpResponseRedirect,
    JsonResponse,
)
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    GmailNotConfiguredError,
    build_gmail_flow,
    create_message,
    create_notification,
    list_notifications,
    list_recent_assets,
    list_recent_messages,
    mark_as_read,
    store_upload,
    # follow services
)
from ..services import (
    send_demo_email as send_demo_email_via_gmail,
)
from ..utils import (
    asset_to_dict,
    message_to_dict,
    notification_to_dict,
    resolve_user_from_request,
)


@csrf_exempt
def messages_endpoint(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        data = [message_to_dict(msg) for msg in list_recent_messages()]
        return JsonResponse({"items": data})

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        content = (payload.get("content") or "").strip()
        if not content:
            return JsonResponse({"error": "`content` is required"}, status=400)

        message = create_message(content=content)
        return JsonResponse(message_to_dict(message), status=201)

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "GET, POST, OPTIONS"
        return response

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def send_demo_email(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload = {}
    if request.body:
        try:
            payload = json.loads(request.body.decode())
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

    subject = payload.get("subject") or "Hello from Django"
    body = payload.get("body") or "This is a sample email sent via the Gmail API."
    recipient = payload.get("recipient")

    try:
        response = send_demo_email_via_gmail(subject=subject, body=body, recipient=recipient)
    except GmailNotConfiguredError as exc:
        return JsonResponse({"error": str(exc)}, status=500)
    except RuntimeError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    return JsonResponse({"status": "sent", "gmail_id": response.get("id")}, status=202)


@csrf_exempt
def files_endpoint(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        assets = [asset_to_dict(asset) for asset in list_recent_assets()]
        return JsonResponse({"items": assets})

    if request.method == "POST":
        upload = request.FILES.get("file")
        if not upload:
            return JsonResponse({"error": "Upload requires a `file` field."}, status=400)

        asset = store_upload(upload)
        return JsonResponse(asset_to_dict(asset), status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def notifications_endpoint(request: HttpRequest) -> JsonResponse:
    user = resolve_user_from_request(request)
    if not user:
        return JsonResponse({"error": "Specify a user via `user` query parameter or X-User header."}, status=400)

    if request.method == "GET":
        notifications, unread = list_notifications(recipient=user)
        items = [notification_to_dict(item) for item in notifications]
        return JsonResponse({"items": items, "unread": unread})

    if request.method == "PATCH":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        ids = payload.get("ids") or []
        if not isinstance(ids, list):
            return JsonResponse({"error": "`ids` must be a list."}, status=400)

        updated = mark_as_read(recipient=user, ids=ids)
        return JsonResponse({"updated": updated})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def simulate_activity(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    actor = (payload.get("actor") or "anonymous").strip()
    recipient = (payload.get("recipient") or "guest").strip()
    action = (payload.get("action") or "comment").strip()
    subject = payload.get("subject") or f"{actor} {action} your post"
    body = payload.get("body") or payload.get("message") or ""
    link = payload.get("link") or ""

    metadata = payload.get("metadata") or {
        "post_id": payload.get("post_id"),
        "reply_id": payload.get("reply_id"),
    }
    metadata = {k: v for k, v in metadata.items() if v is not None}

    notification_payload = create_notification(
        recipient=recipient,
        actor=actor,
        action=action,
        subject=subject,
        body=body,
        link=link,
        metadata=metadata,
    )

    return JsonResponse(notification_payload, status=201)


def gmail_oauth_start(request: HttpRequest):
    try:
        flow = build_gmail_flow()
    except GmailNotConfiguredError as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    request.session["gmail_oauth_state"] = state
    return HttpResponseRedirect(authorization_url)


def gmail_oauth_callback(request: HttpRequest):
    try:
        flow = build_gmail_flow()
    except GmailNotConfiguredError as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    state = request.GET.get("state")
    session_state = request.session.get("gmail_oauth_state")
    if session_state and state != session_state:
        return HttpResponseBadRequest("Invalid OAuth state.")

    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing authorization code.")

    flow.fetch_token(code=code)
    request.session.pop("gmail_oauth_state", None)

    creds = flow.credentials
    refresh_token = creds.refresh_token
    if not refresh_token:
        return JsonResponse(
            {
                "error": "Refresh token was not returned. Ensure you request "
                "offline access and remove previous consents before retrying.",
            },
            status=400,
        )

    return JsonResponse(
        {
            "message": "Success! Copy this refresh token into your .env.",
            "refresh_token": refresh_token,
            "access_token": creds.token,
            "token_expiry": creds.expiry.isoformat() if creds.expiry else None,
        }
    )
