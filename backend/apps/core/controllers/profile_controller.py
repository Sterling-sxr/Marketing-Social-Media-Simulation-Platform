from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    PROFILE_OPTIONS,
    followers_count,
    following_count,
    list_liked_posts,
    list_posts_by_user,
    list_posts_with_analytics_by_user,
    needs_profile,
    profile_to_dict,
    save_profile,
)


def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


def _display_user(user) -> str:
    full_name = (user.get_full_name() or "").strip()
    if full_name:
        return full_name
    if user.first_name or user.last_name:
        name = f"{user.first_name} {user.last_name}".strip()
        if name:
            return name
    if user.username:
        return user.username
    if user.email:
        return user.email
    return f"User {user.pk}"


def _institution_from_email(email: str) -> str:
    if not email:
        return ""
    domain = email.split("@")[-1].lower()
    suffix = ".edu.au"
    if not domain.endswith(suffix):
        return ""
    core = domain[: -len(suffix)].strip(".")
    if not core:
        pretty_domain = domain
    else:
        parts = [part for part in core.split(".") if part and part not in {"ad", "student", "students", "mail"}]
        slug = parts[-1] if parts else core.replace(".", " ")
        pretty_domain = slug.replace("-", " ")
    pretty_name = " ".join(word.capitalize() for word in pretty_domain.split())
    return f"{pretty_name} ({domain})"


def profile_status(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    return JsonResponse({"needs_profile": needs_profile(request.user)})


def profile_options(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    return JsonResponse(PROFILE_OPTIONS)


def get_my_profile(request: HttpRequest) -> JsonResponse:
    """Get current user's profile data."""
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    
    if not hasattr(request.user, "userprofile"):
        return JsonResponse({"error": "Profile not found"}, status=404)
    
    profile_data = profile_to_dict(request.user.userprofile)
    return JsonResponse(profile_data)


@csrf_exempt
def submit_profile(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    # Optional: update username if provided and non-empty
    new_username = (payload.get("username") or "").strip()
    if new_username and new_username != (request.user.username or ""):
        UserModel = get_user_model()
        if UserModel.objects.filter(username=new_username).exclude(id=request.user.id).exists():
            return JsonResponse({"error": "Username is already taken."}, status=400)
        request.user.username = new_username
        request.user.save(update_fields=["username"])

    save_profile(request.user, payload)
    return JsonResponse({"success": True})


def profile_detail(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    UserModel = get_user_model()
    try:
        target = UserModel.objects.get(id=user_id)
    except UserModel.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    profile_data = None
    if hasattr(target, "userprofile"):
        profile_data = profile_to_dict(target.userprofile)

    me = request.user if request.user.is_authenticated else None
    am_following = False
    if me and me.id != target.id:
        from ..repositories import UserFollow
        am_following = UserFollow.objects.filter(follower=me, target=target).exists()

    data = {
        "id": target.id,
        "display_name": _display_user(target),
        "username": target.username or "",
        "email": target.email or "",
        "institution": _institution_from_email(target.email or ""),
        "is_staff": bool(getattr(target, "is_staff", False)),
        "is_superuser": bool(getattr(target, "is_superuser", False)),
        "following_count": following_count(target.id),
        "followers_count": followers_count(target.id),
        "is_following": am_following,
        "profile": profile_data,
    }
    return JsonResponse(data)


@csrf_exempt
def upload_avatar(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    avatar_url = (payload.get("avatar_url") or "").strip()
    if not avatar_url:
        return JsonResponse({"error": "Field `avatar_url` is required."}, status=400)

    profile = save_profile(request.user, {"avatar_url": avatar_url})
    return JsonResponse({"success": True, "avatar_url": profile.avatar_url})


@csrf_exempt
def update_display_name(request: HttpRequest) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    new_name = (payload.get("display_name") or "").strip()
    if not new_name:
        return JsonResponse({"error": "Please provide a display name."}, status=400)
    if len(new_name) > 120:
        return JsonResponse({"error": "Display name must be 120 characters or fewer."}, status=400)

    request.user.first_name = new_name
    request.user.last_name = ""
    request.user.save(update_fields=["first_name", "last_name"])

    return JsonResponse({"display_name": _display_user(request.user)})


@csrf_exempt
def set_user_admin(request: HttpRequest, user_id: int) -> JsonResponse:
    """
    Grant or revoke admin/superuser role.

    NOTE: This endpoint now allows a user to elevate themselves when targeting their own id.
    Use with caution; in production you should lock this down or remove it.
    """
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    is_admin = bool(payload.get("is_admin"))

    UserModel = get_user_model()
    try:
        target = UserModel.objects.get(id=user_id)
    except UserModel.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    # Allow self-elevation; otherwise require existing superuser
    if target.id != request.user.id and not getattr(request.user, "is_superuser", False):
        return JsonResponse({"error": "Only superusers can change admin roles."}, status=403)

    target.is_staff = is_admin
    if payload.get("is_superuser") is not None:
        target.is_superuser = bool(payload.get("is_superuser"))
    target.save(update_fields=["is_staff", "is_superuser"])

    return JsonResponse({
        "id": target.id,
        "username": target.username,
        "email": target.email,
        "is_staff": target.is_staff,
        "is_superuser": target.is_superuser,
    })


@csrf_exempt
def follow_user(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    from ..repositories import UserFollow
    me = request.user
    if request.method == "POST":
        if me.id == user_id:
            return JsonResponse({"error": "You cannot follow yourself."}, status=400)
        
        # Load target user to get username/email for notification
        UserModel = get_user_model()
        try:
            target_user = UserModel.objects.get(id=user_id)
        except UserModel.DoesNotExist:
            return JsonResponse({"error": "User does not exist."}, status=404)

        obj, created = UserFollow.objects.get_or_create(follower_id=me.id, target_id=user_id)
        if created:
            # Send notification to the target user
            try:
                # Ensure we use consistent recipient identifier (strip empty strings)
                recipient = (target_user.username or "").strip() or (target_user.email or "").strip() or str(target_user.id)
                actor_name = (me.username or "").strip() or (me.email or "").strip() or f"User {me.pk}"
                import logging

                from ..services import create_notification
                logger = logging.getLogger(__name__)
                logger.info(f"[FOLLOW] Creating notification for recipient={recipient}, actor={actor_name}")
                create_notification(
                    recipient=recipient,
                    actor=actor_name,
                    action="follow",
                    subject=f"{actor_name} started following you",
                    body="",
                    link=f"/people/{me.id}",
                    metadata={"follower_id": me.id},
                )
                logger.info("[FOLLOW] Notification created successfully")
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"[FOLLOW] Failed to create notification: {e}", exc_info=True)
        return JsonResponse({"success": True})
    if request.method == "DELETE":
        UserFollow.objects.filter(follower_id=me.id, target_id=user_id).delete()
        return JsonResponse({"success": True})
    return JsonResponse({"error": "Method not allowed"}, status=405)


def list_following(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    from ..repositories import UserFollow
    follows = UserFollow.objects.filter(follower_id=user_id).select_related("target").order_by("-created_at")
    items = [
        {"id": f.target.id, "username": f.target.username, "email": f.target.email}
        for f in follows
    ]
    return JsonResponse({"items": items})


def list_followers(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error
    from ..repositories import UserFollow
    follows = UserFollow.objects.filter(target_id=user_id).select_related("follower").order_by("-created_at")
    items = [
        {"id": f.follower.id, "username": f.follower.username, "email": f.follower.email}
        for f in follows
    ]
    return JsonResponse({"items": items})


def user_posts(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    tab = (request.GET.get("tab") or "").strip().lower()
    if tab in {"likes", "liked"}:
        items = list_liked_posts(user=request.user, target_user_id=user_id)
    else:
        items = list_posts_by_user(user=request.user, target_user_id=user_id)
    return JsonResponse({"items": items})


def user_posts_analytics(request: HttpRequest, user_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if request.user.id != user_id and not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({"error": "Forbidden"}, status=403)

    limit_param = request.GET.get("limit")
    limit = None
    if limit_param:
        try:
            limit_value = int(limit_param)
            if limit_value > 0:
                limit = limit_value
        except ValueError:
            limit = None

    items = list_posts_with_analytics_by_user(
        user=request.user,
        target_user_id=user_id,
        limit=limit,
    )
    return JsonResponse({"items": items})


__all__ = [
    "profile_status",
    "profile_options",
    "get_my_profile",
    "submit_profile",
    "profile_detail",
    "upload_avatar",
    "set_user_admin",
    "user_posts",
    "follow_user",
    "list_followers",
    "list_following",
    "user_posts_analytics",
]
