from __future__ import annotations

import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..services import (
    MAX_POST_ATTACHMENTS,
    CourseAccessError,
    CourseCommentNotFoundError,
    CoursePostNotFoundError,
    CourseReadOnlyError,
    add_comment_to_post,
    create_course_post_with_meta,
    delete_comment_from_post,
    delete_course_post,
    get_course_post_analytics,
    get_course_post_detail,
    like_course_post,
    list_course_posts,
    search_course_hashtags,
    search_course_mentions,
    unlike_course_post,
    update_comment_on_post,
    update_course_post,
)


# Purpose: Orchestrate `_ensure_authenticated` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def _ensure_authenticated(request: HttpRequest) -> JsonResponse | None:
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return None


@csrf_exempt
# Purpose: Orchestrate `course_posts` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_posts(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        hashtag = (request.GET.get("hashtag") or "").strip()
        tab = (request.GET.get("tab") or "").strip().lower()
        following_only = tab == "following" or (request.GET.get("following") in {"1", "true", "yes"})
        try:
            data = list_course_posts(
                user=request.user,
                course_id=course_id,
                hashtag=hashtag or None,
                following_only=following_only,
            )
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse(data)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

        content = payload.get("content")
        attachments = payload.get("attachments") or []
        mentions = payload.get("mentions")
        mention_entities = payload.get("mention_entities")
        hashtags = payload.get("hashtags")

        if attachments and not isinstance(attachments, list):
            return JsonResponse({"error": "`attachments` must be an array."}, status=400)
        if mentions is not None and not isinstance(mentions, list):
            return JsonResponse({"error": "`mentions` must be an array."}, status=400)
        if mention_entities is not None and not isinstance(mention_entities, list):
            return JsonResponse({"error": "`mention_entities` must be an array."}, status=400)
        if hashtags is not None and not isinstance(hashtags, list):
            return JsonResponse({"error": "`hashtags` must be an array."}, status=400)

        if attachments and len(attachments) > MAX_POST_ATTACHMENTS:
            return JsonResponse({"error": f"You can upload at most {MAX_POST_ATTACHMENTS} attachments."}, status=400)

        try:
            attachment_ids = [int(item) for item in attachments]
        except (TypeError, ValueError):
            return JsonResponse({"error": "Attachment IDs must be numeric."}, status=400)

        try:
            item = create_course_post_with_meta(
                user=request.user,
                course_id=course_id,
                content=content,
                mentions=mentions,
                mention_entities=mention_entities,
                hashtags=hashtags,
                attachment_ids=attachment_ids,
            )
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseReadOnlyError as exc:
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
# Purpose: Orchestrate `course_post_comments` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_post_comments(request: HttpRequest, course_id: int, post_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        from ..repositories import CoursePostComment
        comments = (
            CoursePostComment.objects.select_related("user", "post")
            .filter(post_id=post_id, post__course_id=course_id)
            .order_by("id")
        )
        items = [
            {
                "id": c.id,
                "user": {
                    "id": c.user_id,
                    "name": getattr(c.user, "username", "") or getattr(c.user, "email", ""),
                    "avatar_url": getattr(c.user, "avatar_url", ""),
                },
                "content": c.content,
                "created_at": c.created_at.isoformat(),
            }
            for c in comments
        ]
        return JsonResponse({"items": items})

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Request body must be valid JSON."}, status=400)
        content = (payload.get("content") or "").strip()
        if not content:
            return JsonResponse({"error": "Comment content cannot be empty."}, status=400)
        try:
            item = add_comment_to_post(
                user=request.user,
                course_id=course_id,
                post_id=post_id,
                content=content,
            )
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CoursePostNotFoundError:
            return JsonResponse({"error": "Post not found."}, status=404)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        return JsonResponse(item, status=201)

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "GET, POST, OPTIONS"
        return response

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def course_post_comment_detail(
    request: HttpRequest,
    course_id: int,
    post_id: int,
    comment_id: int,
) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "PATCH":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

        try:
            item = update_comment_on_post(
                user=request.user,
                course_id=course_id,
                post_id=post_id,
                comment_id=comment_id,
                content=payload.get("content"),
            )
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseCommentNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        return JsonResponse(item)

    if request.method == "DELETE":
        try:
            delete_comment_from_post(
                user=request.user,
                course_id=course_id,
                post_id=post_id,
                comment_id=comment_id,
            )
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseCommentNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"success": True})

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "PATCH, DELETE, OPTIONS"
        return response

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def course_post_like(request: HttpRequest, course_id: int, post_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "POST":
        try:
            item = like_course_post(user=request.user, course_id=course_id, post_id=post_id)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CoursePostNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"item": item}, status=201)

    if request.method == "DELETE":
        try:
            item = unlike_course_post(user=request.user, course_id=course_id, post_id=post_id)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CoursePostNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"item": item})

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "POST, DELETE, OPTIONS"
        return response

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
# Purpose: Orchestrate `course_post_detail` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_post_detail(request: HttpRequest, course_id: int, post_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Allow"] = "GET, PATCH, DELETE, OPTIONS"
        return response

    if request.method == "GET":
        try:
            item = get_course_post_detail(user=request.user, course_id=course_id, post_id=post_id)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CoursePostNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        course_info = item.get("course")
        response_payload = {"item": item}
        if course_info:
            response_payload["course"] = course_info
        return JsonResponse(response_payload)

    if request.method == "PATCH":
        try:
            payload = json.loads(request.body.decode() or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

        attachments = payload.get("attachments", None)
        mentions = payload.get("mentions", None)
        mention_entities = payload.get("mention_entities", None)
        hashtags = payload.get("hashtags", None)

        if attachments is not None and not isinstance(attachments, list):
            return JsonResponse({"error": "`attachments` must be an array."}, status=400)
        if mentions is not None and not isinstance(mentions, list):
            return JsonResponse({"error": "`mentions` must be an array."}, status=400)
        if mention_entities is not None and not isinstance(mention_entities, list):
            return JsonResponse({"error": "`mention_entities` must be an array."}, status=400)
        if hashtags is not None and not isinstance(hashtags, list):
            return JsonResponse({"error": "`hashtags` must be an array."}, status=400)

        try:
            item = update_course_post(
                user=request.user,
                course_id=course_id,
                post_id=post_id,
                content=payload.get("content"),
                mentions=mentions,
                mention_entities=mention_entities,
                hashtags=hashtags,
                attachment_ids=attachments,
            )
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CoursePostNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)

        return JsonResponse({"item": item})

    if request.method == "DELETE":
        try:
            delete_course_post(user=request.user, course_id=course_id, post_id=post_id)
        except CourseReadOnlyError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CourseAccessError as exc:
            return JsonResponse({"error": str(exc)}, status=403)
        except CoursePostNotFoundError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        return JsonResponse({"success": True})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
# Purpose: Orchestrate `course_post_analytics` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_post_analytics(request: HttpRequest, course_id: int, post_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        days = int(request.GET.get("days", "7"))
    except (TypeError, ValueError):
        days = 7

    try:
        data = get_course_post_analytics(
            user=request.user,
            course_id=course_id,
            post_id=post_id,
            days=days,
        )
    except CourseAccessError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except CoursePostNotFoundError as exc:
        return JsonResponse({"error": str(exc)}, status=404)
    return JsonResponse(data)


@csrf_exempt
# Purpose: Orchestrate `course_post_suggestions` with clear validation, dependency calls, and response mapping.
# Input contract: Normalize required values early and fail fast on malformed payloads.
# Output contract: Return a stable success/error shape after translating service outcomes.
def course_post_suggestions(request: HttpRequest, course_id: int) -> JsonResponse:
    auth_error = _ensure_authenticated(request)
    if auth_error:
        return auth_error

    kind = (request.GET.get("type") or "mention").lower()
    query = request.GET.get("q") or ""

    try:
        if kind == "mention":
            items = search_course_mentions(user=request.user, course_id=course_id, query=query)
        elif kind == "hashtag":
            items = search_course_hashtags(user=request.user, course_id=course_id, query=query)
        else:
            return JsonResponse({"error": "Unknown suggestion type."}, status=400)
    except CourseAccessError as exc:
        return JsonResponse({"error": str(exc)}, status=403)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    return JsonResponse({"items": items})


__all__ = [
    "course_posts",
    "course_post_like",
    "course_post_suggestions",
    "course_post_comments",
    "course_post_comment_detail",
    "course_post_detail",
    "course_post_analytics",
]
