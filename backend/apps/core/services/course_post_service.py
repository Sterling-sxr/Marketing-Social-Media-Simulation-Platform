"""Module summary: Collect related domain logic and document the intended design boundaries."""
from __future__ import annotations

import logging
import re
import threading
from collections import defaultdict
from datetime import timedelta
from typing import Any, Iterable, Sequence

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Prefetch
from django.db.models.functions import TruncDate
from django.utils import timezone

from ..repositories import (
    Course,
    CourseMemberRepository,
    CoursePost,
    CoursePostAttachment,
    CoursePostComment,
    CoursePostLike,
    CoursePostMention,
    CoursePostView,
    # Context: Compute shared values once so all branches use the same normalized inputs.
    CourseProfileRepository,
    CourseRepository,
    FollowRepository,
    PostAnalyticsSnapshotRepository,
    PostAttachmentRepository,
    PostCommentRepository,
    PostLikeRepository,
    PostMentionRepository,
    PostRepository,
    PostViewRepository,
    UserRepository,
)
from ..services.notification_service import create_notification
from ..utils import asset_to_dict
from .ai_user_reaction_service import evaluate_persona_prompt
from .dashboard_service import classify_comment_sentiment

logger = logging.getLogger(__name__)

MAX_POST_ATTACHMENTS = 4
RECOMMENDATION_WINDOW_DAYS = int(getattr(settings, "POST_RECOMMENDATION_WINDOW_DAYS", 7))
MAX_RECOMMENDATIONS = int(getattr(settings, "POST_RECOMMENDATION_LIMIT", 5))


class CourseAccessError(PermissionError):
    """Class summary: CourseAccessError keeps related behavior together behind one clear interface."""


class CoursePostNotFoundError(ValueError):
    """Class summary: CoursePostNotFoundError keeps related behavior together behind one clear interface."""


class CourseReadOnlyError(PermissionError):
    """Class summary: CourseReadOnlyError keeps related behavior together behind one clear interface."""


def _display_name(user) -> str:
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


def _get_course(course_id: int) -> Course:
    """Execute the `_get_course` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    course = CourseRepository.get_by_id(course_id)
    if not course:
        raise ValueError("Course not found.")
    return course


def _course_is_read_only(course: Course) -> bool:
    """Execute the `_course_is_read_only` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not course.end_date:
        return False
    today = timezone.localdate()
    return today > course.end_date


def _ensure_course_active(course: Course) -> None:
    """Execute the `_ensure_course_active` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if _course_is_read_only(course):
        raise CourseReadOnlyError("This course has ended; posts are read-only.")


def _ensure_membership(course: Course, user):
    """Execute the `_ensure_membership` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not CourseRepository.is_user_member(course.id, user.id):
        raise CourseAccessError("You must join this course before you can access its posts.")
    # Context: Compute shared values once so all branches use the same normalized inputs.
    role = CourseRepository.get_user_role(course.id, user.id)
    return type('Membership', (), {'course': course, 'user': user, 'role': role or 'student'})()


def _user_is_admin(user) -> bool:
    return bool(getattr(user, "is_superuser", False) or getattr(user, "is_staff", False))


def _can_edit_post_for_user(user, post) -> bool:
    if not user or not post:
        return False
    if getattr(post, "author_id", None) == getattr(user, "id", None):
        return True
    return False


def _can_delete_post_for_user(user, post) -> bool:
    if not user or not post:
        return False
    if getattr(post, "author_id", None) == getattr(user, "id", None):
        return True
    if _user_is_admin(user):
        return True
    return False


def _extract_mentions(content: str, provided: Sequence[str] | None = None) -> list[str]:
    if provided is not None:
        return list(dict.fromkeys([item.strip() for item in provided if item and item.strip()]))
    pattern = re.compile(r"@([^\s@#]+)")
    return list(dict.fromkeys(pattern.findall(content or "")))


def _extract_hashtags(content: str, provided: Sequence[str] | None = None) -> list[str]:
    if provided is not None:
        return list(
            dict.fromkeys(
                [item.strip().lstrip("#").lower() for item in provided if item and item.strip()]
            )
        )
    pattern = re.compile(r"#([^\s@#]+)")
    return list(dict.fromkeys(match.lower() for match in pattern.findall(content or "")))


def _normalize_insert_candidate(user) -> str:
    if user.username:
        return user.username
    full_name = (user.get_full_name() or "").strip()
    if full_name and " " not in full_name:
        return full_name
    if user.first_name and user.last_name:
        condensed = f"{user.first_name}{user.last_name}".replace(" ", "")
        if condensed:
            return condensed
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.pk}"


def _serialize_attachments(post: CoursePost) -> list[dict[str, Any]]:
    attachments = getattr(post, "prefetched_attachments", None)
    if attachments is None:
        attachments = post.attachments.select_related("asset").all()
    return [
        {
            **asset_to_dict(attachment.asset),
            "attachment_id": attachment.id,
        }
        for attachment in attachments
    ]


def _serialize_posts(
    posts: Iterable[CoursePost],
    *,
    liked_ids: set[int],
    like_counts: dict[int, int],
    current_user=None,
) -> list[dict[str, Any]]:
    serialized = []
    for post in posts:
        mention_details = []
        mention_map: dict[str, dict[str, Any]] = {}
        mentions_prefetched = getattr(post, "prefetched_mentions", None)
        if mentions_prefetched is None:
            mentions_prefetched = post.mentions_rel.select_related("user").all()
        for mention in mentions_prefetched:
            detail = {
                "id": mention.user_id,
                "display": _display_name(mention.user),
                "username": getattr(mention.user, "username", "") or "",
                "identifier": mention.identifier or "",
            }
            mention_details.append(detail)
            identifier_key = (mention.identifier or "").lower()
            if identifier_key:
                mention_map[identifier_key] = detail

        comments_count = getattr(post, "prefetched_comments_count", None)
        if comments_count is None:
            comments_count = CoursePostComment.objects.filter(post_id=post.id).count()

        serialized.append(
            {
                "id": post.id,
                "course_id": post.course_id,
                "content": post.content,
                "author": {
                    "id": post.author_id,
                    "name": _display_name(post.author),
                    "avatar_url": getattr(post.author, "avatar_url", ""),
                },
                "created_at": post.created_at.isoformat(),
                "updated_at": post.updated_at.isoformat(),
                "likes_count": like_counts.get(post.id, 0),
                "liked_by_me": post.id in liked_ids,
                "comments_count": comments_count,
                "mentions": post.mentions or [],
                "mentions_detail": _merge_mention_details(post.mentions or [], mention_map, mention_details),
                "hashtags": post.hashtags or [],
                "attachments": _serialize_attachments(post),
                "can_edit": _can_edit_post_for_user(current_user, post),
                "can_delete": _can_delete_post_for_user(current_user, post),
            }
        )
    return serialized


def _merge_mention_details(
    mentions: Sequence[str],
    mention_map: dict[str, dict[str, Any]],
    default_list: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not mentions:
        return default_list
    merged: list[dict[str, Any]] = []
    seen = set()
    for raw in mentions:
        normalized = (raw or "").strip().lstrip("@").lower()
        detail = mention_map.get(normalized)
        if detail:
            merged.append(detail)
            seen.add(detail.get("id"))
        else:
            merged.append({"id": None, "display": raw, "username": raw, "identifier": normalized})
    for detail in default_list:
        detail_id = detail.get("id")
        if detail_id and detail_id in seen:
            continue
        merged.append(detail)
    return merged


def list_course_posts(*, user, course_id: int, hashtag: str | None = None, following_only: bool = False) -> dict[str, Any]:
    """Execute the `list_course_posts` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    # Context: Compute shared values once so all branches use the same normalized inputs.
    course = _get_course(course_id)
    membership = _ensure_membership(course, user)
    read_only = _course_is_read_only(course)

    # Context: Compute shared values once so all branches use the same normalized inputs.
    following_ids = None
    if following_only:
        following_ids = list(FollowRepository.get_following_ids(user.id))
        if not following_ids:
            return {
                "course": {
                    "id": course.id,
                    "name": course.name,
                    "course_code": course.course_code,
                    "term": course.term,
                    "role": membership.role,
                },
                "items": [],
            }

    # Context: Compute shared values once so all branches use the same normalized inputs.
    active_hashtag = None
    if hashtag:
        raw_tag = hashtag.strip().lstrip("#")
        active_hashtag = raw_tag.lower() or raw_tag

    # Context: Compute shared values once so all branches use the same normalized inputs.
    posts = PostRepository.get_course_posts(
        course_id=course_id,
        hashtag=active_hashtag,
        following_only=following_only,
        following_ids=following_ids,
    )

    if not posts:
        payload = {
            "course": {
                "id": course.id,
                "name": course.name,
                "course_code": course.course_code,
                "term": course.term,
                "role": membership.role,
                "start_date": course.start_date.isoformat() if getattr(course, "start_date", None) else None,
                "end_date": course.end_date.isoformat() if getattr(course, "end_date", None) else None,
                "read_only": read_only,
            },
            "items": [],
        }
        if active_hashtag:
            payload["filter"] = {"hashtag": active_hashtag}
        return payload

    post_ids = [p.id for p in posts]

    # Context: Compute shared values once so all branches use the same normalized inputs.
    like_count_map = PostLikeRepository.get_like_counts(post_ids)
    liked_ids = PostLikeRepository.get_user_liked_posts(user.id, post_ids)
    comment_count_map = PostCommentRepository.get_comment_counts(post_ids)
    
    # Context: Compute shared values once so all branches use the same normalized inputs.
    for p in posts:
        setattr(p, "prefetched_comments_count", comment_count_map.get(p.id, 0))

    payload = {
        "course": {
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "term": course.term,
            "role": membership.role,
            "start_date": course.start_date.isoformat() if getattr(course, "start_date", None) else None,
            "end_date": course.end_date.isoformat() if getattr(course, "end_date", None) else None,
            "read_only": read_only,
        },
        "items": _serialize_posts(
            posts,
            liked_ids=liked_ids,
            like_counts=like_count_map,
            current_user=user,
        ),
    }
    if active_hashtag:
        payload["filter"] = {"hashtag": active_hashtag}
    return payload


def create_course_post(*, user, course_id: int, content: str) -> dict[str, Any]:
    return create_course_post_with_meta(
        user=user,
        course_id=course_id,
        content=content,
        mentions=None,
        hashtags=None,
        attachment_ids=None,
    )


def create_course_post_with_meta(
    *,
    user,
    course_id: int,
    content: str,
    mentions: Sequence[str] | None,
    mention_entities: Sequence[dict[str, Any]] | None,
    hashtags: Sequence[str] | None,
    attachment_ids: Sequence[int] | None,
) -> dict[str, Any]:
    """Execute the `create_course_post_with_meta` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    # Context: Compute shared values once so all branches use the same normalized inputs.
    course = _get_course(course_id)
    _ensure_membership(course, user)
    _ensure_course_active(course)

    # Context: Compute shared values once so all branches use the same normalized inputs.
    sanitized = (content or "").strip()
    if not sanitized:
        raise ValueError("Post content cannot be empty.")

    # Context: Compute shared values once so all branches use the same normalized inputs.
    extracted_mentions = _extract_mentions(sanitized, mentions)
    mention_entity_map: dict[str, int] = {}
    if mention_entities:
        for entity in mention_entities:
            value = str(entity.get("value") or "").strip().lstrip("@").lower()
            user_id = entity.get("user_id")
            if value and user_id:
                mention_entity_map[value] = int(user_id)
    extracted_hashtags = _extract_hashtags(sanitized, hashtags)

    # Context: Compute shared values once so all branches use the same normalized inputs.
    post = PostRepository.create(
        course_id=course_id,
        author_id=user.id,
        content=sanitized,
        mentions=extracted_mentions,
        hashtags=extracted_hashtags,
    )

    # Context: Compute shared values once so all branches use the same normalized inputs.
    normalized_attachment_ids: list[int] = []
    if attachment_ids:
        seen: set[int] = set()
        for raw_id in attachment_ids:
            try:
                normalized = int(raw_id)
            except (TypeError, ValueError):
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            normalized_attachment_ids.append(normalized)

    if len(normalized_attachment_ids) > MAX_POST_ATTACHMENTS:
        raise ValueError(f"You can upload at most {MAX_POST_ATTACHMENTS} attachments.")

    # Context: Compute shared values once so all branches use the same normalized inputs.
    if normalized_attachment_ids:
        PostAttachmentRepository.attach_to_post(post.id, normalized_attachment_ids)
        # Context: Compute shared values once so all branches use the same normalized inputs.
        post = PostRepository.get_with_details(post.id)
        post.prefetched_attachments = post.attachments.all()
    else:
        post.prefetched_attachments = []

    # Context: Compute shared values once so all branches use the same normalized inputs.
    if mention_entity_map:
        to_create = []
        for mention_value in extracted_mentions:
            key = mention_value.lower()
            user_id = mention_entity_map.get(key)
            if user_id:
                to_create.append({"user_id": user_id, "identifier": key})
        
        # Context: Compute shared values once so all branches use the same normalized inputs.
        if to_create:
            PostMentionRepository.create_mentions(post.id, to_create)
            # Context: Compute shared values once so all branches use the same normalized inputs.
            post = PostRepository.get_with_details(post.id)
            post.prefetched_mentions = post.mentions_rel.all()
    
    if not hasattr(post, "prefetched_mentions"):
        post.prefetched_mentions = []

    mention_recipient_ids: set[int] = set()

    # Context: Compute shared values once so all branches use the same normalized inputs.
    try:
        actor_name = _display_name(user)
        post_link = f"/courses/{course_id}/posts/{post.id}"
        post_preview = sanitized[:140]

        for mention in post.prefetched_mentions:
            if not mention.user_id or mention.user_id == getattr(user, "id", None):
                continue
            target_user = mention.user
            recipient = (
                (target_user.username or "").strip()
                or (target_user.email or "").strip()
                or str(target_user.id)
            )
            subject = f"{actor_name} mentioned you in a course post"
            link = f"/courses/{course_id}/posts/{post.id}"
            preview = sanitized[:140]
            logger.info(f"[MENTION] Creating notification for recipient={recipient}, actor={actor_name}")
            create_notification(
                recipient=recipient,
                actor=actor_name,
                action="mention",
                subject=subject,
                body=preview,
                link=link,
                metadata={"course_id": course_id, "post_id": post.id, "mention": mention.identifier or ""},
            )
            logger.info("[MENTION] Notification created successfully")
            if getattr(target_user, "id", None):
                mention_recipient_ids.add(target_user.id)

        # Context: Compute shared values once so all branches use the same normalized inputs.
        follower_ids = FollowRepository.get_follower_ids(getattr(user, "id", None))
        if follower_ids:
            follower_ids.discard(getattr(user, "id", None))
            if follower_ids:
                User = get_user_model()
                followers = User.objects.filter(id__in=follower_ids).only(
                    "id", "username", "email", "first_name", "last_name"
                )
                subject = f"{actor_name} shared a new update"
                body = (
                    f"{actor_name} just posted in {course.course_code}. "
                    f"{post_preview}"
                ).strip()
                for follower in followers:
                    recipient = (
                        (follower.username or "").strip()
                        or (follower.email or "").strip()
                        or str(follower.id)
                    )
                    if not recipient or follower.id == getattr(user, "id", None):
                        continue
                    create_notification(
                        recipient=recipient,
                        actor=actor_name,
                        action="follow_post",
                        subject=subject,
                        body=body,
                        link=post_link,
                        metadata={
                            "course_id": course_id,
                            "post_id": post.id,
                            "author_id": getattr(user, "id", None),
                        },
                    )
                logger.info("[FOLLOWERS] Broadcasted post notification to followers.")

        excluded_user_ids: set[int] = set(uid for uid in mention_recipient_ids if uid)
        if follower_ids:
            excluded_user_ids.update(follower_ids)
        author_id = getattr(user, "id", None)
        if author_id:
            excluded_user_ids.add(author_id)
        _schedule_interest_recommendations(course_id, post.id, list(excluded_user_ids))
    except Exception as e:
        # Context: Compute shared values once so all branches use the same normalized inputs.
        logger.error(f"[NOTIFY] Failed to create notification: {e}", exc_info=True)

    def _schedule_post_tasks() -> None:
        try:
            from .ai_user_reaction_service import schedule_ai_reactions

            delay = float(getattr(settings, "DEEPSEEK_POST_DELAY_SECONDS", "1.0"))
            schedule_ai_reactions(course_id, post.id, delay_seconds=delay)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to schedule AI reactions for post=%s", post.id)

    transaction.on_commit(_schedule_post_tasks)

    return _serialize_posts(
        [post],
        liked_ids=set(),
        like_counts={post.id: 0},
        current_user=user,
    )[0]


def search_course_mentions(*, user, course_id: int, query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Execute the `search_course_mentions` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    # Context: Compute shared values once so all branches use the same normalized inputs.
    course = _get_course(course_id)
    _ensure_membership(course, user)

    normalized = (query or "").strip()

    # Context: Compute shared values once so all branches use the same normalized inputs.
    if normalized:
        found_users = UserRepository.search_in_course(course_id, normalized, limit)
    else:
        # Context: Compute shared values once so all branches use the same normalized inputs.
        members = CourseMemberRepository.get_course_members(course_id)
        found_users = [m.user for m in members if m.user_id != user.id][:limit]

    # Context: Compute shared values once so all branches use the same normalized inputs.
    results: list[dict[str, Any]] = []
    for target in found_users:
        if target.id == user.id:
            continue
        display_name = _display_name(target)
        insert_value = _normalize_insert_candidate(target)
        role = CourseRepository.get_user_role(course_id, target.id)
        results.append(
            {
                "type": "mention",
                "id": target.id,
                "display": display_name,
                "insert": insert_value,
                "meta": {
                    "role": role or "student",
                    "email": target.email,
                },
            }
        )
    return results


def search_course_hashtags(*, user, course_id: int, query: str, limit: int = 10) -> list[dict[str, Any]]:
    course = _get_course(course_id)
    _ensure_membership(course, user)

    normalized = (query or "").strip().lower()
    candidates: dict[str, int] = {}

    posts = CoursePost.objects.filter(course=course).values_list("hashtags", flat=True)
    for tag_list in posts:
        if not tag_list:
            continue
        for tag in tag_list:
            if not tag:
                continue
            tag_text = str(tag)
            if normalized and normalized not in tag_text.lower():
                continue
            candidates[tag_text] = candidates.get(tag_text, 0) + 1

    sorted_items = sorted(
        candidates.items(),
        key=lambda item: (-item[1], item[0].lower()),
    )

    results: list[dict[str, Any]] = []
    for tag, count in sorted_items[:limit]:
        results.append(
            {
                "type": "hashtag",
                "display": f"#{tag}",
                "insert": tag,
                "count": count,
            }
        )
    return results


def like_course_post(*, user, course_id: int, post_id: int) -> dict[str, Any]:
    """Execute the `like_course_post` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    # Context: Compute shared values once so all branches use the same normalized inputs.
    course = _get_course(course_id)
    _ensure_membership(course, user)
    _ensure_course_active(course)

    # Context: Compute shared values once so all branches use the same normalized inputs.
    post = PostRepository.get_with_details(post_id)
    if not post or post.course_id != course_id:
        raise CoursePostNotFoundError("The post does not exist in this course.")

    # Context: Compute shared values once so all branches use the same normalized inputs.
    _, created = PostLikeRepository.get_or_create_like(post_id, user.id)

    # Context: Compute shared values once so all branches use the same normalized inputs.
    if created and post.author_id != getattr(user, "id", None):
        try:
            recipient = (
                (post.author.username or "").strip()
                or (post.author.email or "").strip()
                or str(post.author_id)
            )
            actor_name = _display_name(user)
            subject = f"{actor_name} liked your post"
            body = ""
            link = f"/courses/{course_id}"
            create_notification(
                recipient=recipient,
                actor=actor_name,
                action="like",
                subject=subject,
                body=body,
                link=link,
                metadata={"course_id": course_id, "post_id": post.id},
            )
        except Exception:  # noqa: BLE001 - avoid breaking like flow on notification errors
            pass

    like_count = post.likes.count()
    return _serialize_posts(
        [post],
        liked_ids={post.id},
        like_counts={post.id: like_count},
        current_user=user,
    )[0]


def unlike_course_post(*, user, course_id: int, post_id: int) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_membership(course, user)
    _ensure_course_active(course)

    try:
        post = (
            CoursePost.objects.select_related("author")
            .prefetch_related(
                Prefetch(
                    "attachments",
                    queryset=CoursePostAttachment.objects.select_related("asset").order_by("id"),
                    to_attr="prefetched_attachments",
                )
            )
            .get(id=post_id, course=course)
        )
    except CoursePost.DoesNotExist as exc:
        raise CoursePostNotFoundError("The post does not exist in this course.") from exc

    CoursePostLike.objects.filter(post=post, user=user).delete()

    like_count = post.likes.count()
    return _serialize_posts(
        [post],
        liked_ids=set(),
        like_counts={post.id: like_count},
        current_user=user,
    )[0]


def add_comment_to_post(
    *,
    user,
    course_id: int,
    post_id: int,
    content: str,
    suppress_notifications: bool = False,
) -> dict[str, Any]:
    """Execute the `add_comment_to_post` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    course = _get_course(course_id)
    _ensure_membership(course, user)
    _ensure_course_active(course)

    sanitized = (content or "").strip()
    if not sanitized:
        raise ValueError("Comment content cannot be empty.")

    try:
        post = (
            CoursePost.objects.select_related("course", "author")
            .get(id=post_id, course=course)
        )
    except CoursePost.DoesNotExist as exc:
        raise CoursePostNotFoundError("The post does not exist in this course.") from exc

    comment = CoursePostComment.objects.create(
        post=post,
        user=user,
        content=sanitized,
    )

    if not suppress_notifications and post.author_id != getattr(user, "id", None):
        try:
            recipient = (
                (post.author.username or "").strip()
                or (post.author.email or "").strip()
                or str(post.author_id)
            )
            actor_name = _display_name(user)
            subject = f"{actor_name} commented on your post"
            body = sanitized[:200]
            link = f"/courses/{course_id}/posts/{post.id}"
            create_notification(
                recipient=recipient,
                actor=actor_name,
                action="comment",
                subject=subject,
                body=body,
                link=link,
                metadata={"course_id": course_id, "post_id": post.id},
            )
        except Exception:  # noqa: BLE001
            pass

    return {
        "id": comment.id,
        "content": comment.content,
        "created_at": comment.created_at.isoformat(),
        "user": {
            "id": user.id,
            "name": _display_name(user),
            "username": getattr(user, "username", ""),
        },
    }


def update_course_post(
    *,
    user,
    course_id: int,
    post_id: int,
    content: str | None = None,
    mentions: Sequence[str] | None = None,
    mention_entities: Sequence[dict[str, Any]] | None = None,
    hashtags: Sequence[str] | None = None,
    attachment_ids: Sequence[int] | None = None,
) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_membership(course, user)
    if _course_is_read_only(course) and not _user_is_admin(user):
        raise CourseReadOnlyError("This course has ended; posts are read-only.")

    try:
        post = (
            CoursePost.objects.select_related("author")
            .prefetch_related(
                Prefetch(
                    "attachments",
                    queryset=CoursePostAttachment.objects.select_related("asset").order_by("id"),
                    to_attr="prefetched_attachments",
                ),
                Prefetch(
                    "mentions_rel",
                    queryset=CoursePostMention.objects.select_related("user").order_by("id"),
                    to_attr="prefetched_mentions",
                ),
            )
            .get(id=post_id, course_id=course_id)
        )
    except CoursePost.DoesNotExist as exc:
        raise CoursePostNotFoundError("The post does not exist in this course.") from exc

    if not _can_edit_post_for_user(user, post):
        raise CourseAccessError("You do not have permission to edit this post.")

    sanitized = (content if content is not None else post.content or "").strip()
    if not sanitized:
        raise ValueError("Post content cannot be empty.")

    extracted_mentions = _extract_mentions(sanitized, mentions)
    mention_entity_map: dict[str, int] = {}
    if mention_entities:
        for entity in mention_entities:
            value = str(entity.get("value") or "").strip().lstrip("@").lower()
            user_id = entity.get("user_id")
            if value and user_id:
                mention_entity_map[value] = int(user_id)
    extracted_hashtags = _extract_hashtags(sanitized, hashtags)

    post.content = sanitized
    post.mentions = extracted_mentions
    post.hashtags = extracted_hashtags
    post.save(update_fields=["content", "mentions", "hashtags", "updated_at"])

    if attachment_ids is not None:
        normalized_attachment_ids: list[int] = []
        seen: set[int] = set()
        for raw_id in attachment_ids:
            try:
                normalized = int(raw_id)
            except (TypeError, ValueError):
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            normalized_attachment_ids.append(normalized)

        if len(normalized_attachment_ids) > MAX_POST_ATTACHMENTS:
            raise ValueError(f"You can upload at most {MAX_POST_ATTACHMENTS} attachments.")

        existing_ids = set(
            CoursePostAttachment.objects.filter(post_id=post.id).values_list("asset_id", flat=True)
        )
        CoursePostAttachment.objects.filter(post_id=post.id).exclude(
            asset_id__in=normalized_attachment_ids
        ).delete()
        to_add = [asset_id for asset_id in normalized_attachment_ids if asset_id not in existing_ids]
        if to_add:
            PostAttachmentRepository.attach_to_post(post.id, to_add)

    CoursePostMention.objects.filter(post_id=post.id).delete()
    if mention_entity_map:
        to_create = []
        for mention_value in extracted_mentions:
            key = mention_value.lower()
            user_id = mention_entity_map.get(key)
            if user_id:
                to_create.append({"user_id": user_id, "identifier": key})
        if to_create:
            PostMentionRepository.create_mentions(post.id, to_create)

    post = PostRepository.get_with_details(post.id)
    post.prefetched_comments_count = CoursePostComment.objects.filter(post_id=post.id).count()
    like_count = CoursePostLike.objects.filter(post_id=post.id).count()
    liked = CoursePostLike.objects.filter(post_id=post.id, user_id=user.id).exists()
    liked_ids = {post.id} if liked else set()
    return _serialize_posts(
        [post],
        liked_ids=liked_ids,
        like_counts={post.id: like_count},
        current_user=user,
    )[0]


def delete_course_post(*, user, course_id: int, post_id: int) -> None:
    course = _get_course(course_id)
    _ensure_membership(course, user)
    if _course_is_read_only(course) and not _user_is_admin(user):
        raise CourseReadOnlyError("This course has ended; posts are read-only.")

    try:
        post = CoursePost.objects.get(id=post_id, course_id=course_id)
    except CoursePost.DoesNotExist as exc:
        raise CoursePostNotFoundError("The post does not exist in this course.") from exc

    if not _can_delete_post_for_user(user, post):
        raise CourseAccessError("You do not have permission to delete this post.")

    post.delete()


def get_course_post_detail(*, user, course_id: int, post_id: int) -> dict[str, Any]:
    course = _get_course(course_id)
    membership = _ensure_membership(course, user)
    read_only = _course_is_read_only(course)

    try:
        post = (
            CoursePost.objects.select_related("author")
            .prefetch_related(
                Prefetch(
                    "attachments",
                    queryset=CoursePostAttachment.objects.select_related("asset").order_by("id"),
                    to_attr="prefetched_attachments",
                ),
                Prefetch(
                    "mentions_rel",
                    queryset=CoursePostMention.objects.select_related("user").order_by("id"),
                    to_attr="prefetched_mentions",
                ),
            )
            .get(id=post_id, course=course)
        )
    except CoursePost.DoesNotExist as exc:
        raise CoursePostNotFoundError("The post does not exist in this course.") from exc

    like_count = post.likes.count()
    liked_ids = {post.id} if CoursePostLike.objects.filter(post=post, user=user).exists() else set()

    # Context: Compute shared values once so all branches use the same normalized inputs.
    setattr(
        post,
        "prefetched_comments_count",
        CoursePostComment.objects.filter(post_id=post.id).count(),
    )

    # Context: Compute shared values once so all branches use the same normalized inputs.
    try:
        PostViewRepository.create_view(post_id=post.id, user_id=getattr(user, "id", None))
    except Exception:
        pass

    payload = _serialize_posts(
        [post],
        liked_ids=liked_ids,
        like_counts={post.id: like_count},
        current_user=user,
    )[0]
    payload["course"] = {
        "id": course.id,
        "name": course.name,
        "course_code": course.course_code,
        "term": course.term,
        "role": membership.role,
        "start_date": course.start_date.isoformat() if getattr(course, "start_date", None) else None,
        "end_date": course.end_date.isoformat() if getattr(course, "end_date", None) else None,
        "read_only": read_only,
    }
    return payload


def _compute_sentiment_counts_for_post(post_id: int) -> dict[str, int]:
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    comment_texts = CoursePostComment.objects.filter(post_id=post_id).values_list("content", flat=True)
    for content in comment_texts:
        try:
            label = classify_comment_sentiment(content or "")
        except Exception:
            label = "neutral"
        counts[label] = counts.get(label, 0) + 1
    return counts


def get_course_post_analytics(
    *,
    user,
    course_id: int,
    post_id: int,
    days: int = 7,
) -> dict[str, Any]:
    """Execute the `get_course_post_analytics` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    course = _get_course(course_id)
    _ensure_membership(course, user)

    try:
        post_obj = CoursePost.objects.get(id=post_id, course_id=course_id)
    except CoursePost.DoesNotExist as exc:
        raise CoursePostNotFoundError("The post does not exist in this course.") from exc

    days = max(1, min(days, 30))
    end_date = timezone.localdate()
    start_date = end_date - timedelta(days=days - 1)
    date_axis = [start_date + timedelta(days=i) for i in range(days)]

    def _aggregate_daily(model):
        records = (
            model.objects.filter(
                post_id=post_id,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
            )
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(total=Count("id"))
        )
        return {entry["day"]: entry["total"] for entry in records}

    like_map = _aggregate_daily(CoursePostLike)
    comment_map = _aggregate_daily(CoursePostComment)
    view_map = _aggregate_daily(CoursePostView)

    def _build_series(source: dict) -> list[dict[str, Any]]:
        return [
            {"date": day.isoformat(), "count": int(source.get(day, 0))}
            for day in date_axis
        ]

    totals = {
        "likes": CoursePostLike.objects.filter(post_id=post_id).count(),
        "comments": CoursePostComment.objects.filter(post_id=post_id).count(),
        "views": CoursePostView.objects.filter(post_id=post_id).count(),
    }

    snapshot = PostAnalyticsSnapshotRepository.get_by_post(post_id)
    if snapshot:
        sentiment_counts = snapshot.sentiment_counts or {}
        sentiment_percentages = snapshot.sentiment_percentages or {}
        sentiment_total = (
            sentiment_counts.get("positive", 0)
            + sentiment_counts.get("neutral", 0)
            + sentiment_counts.get("negative", 0)
        )
    else:
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
        sentiment_percentages = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
        sentiment_total = 0

    if totals["comments"] > 0 and sentiment_total == 0:
        sentiment_counts = _compute_sentiment_counts_for_post(post_id)
        sentiment_total = sum(sentiment_counts.values())
        sentiment_percentages = {
            key: round(value * 100 / sentiment_total, 1) if sentiment_total else 0.0
            for key, value in sentiment_counts.items()
        }

    hashtags_data: list[dict[str, Any]] = []
    post_hashtags = post_obj.hashtags or []
    if post_hashtags:
        for tag in post_hashtags:
            tag = str(tag).strip()
            if not tag:
                continue
            cohort_ids = list(
                CoursePost.objects.filter(
                    course_id=course_id,
                    hashtags__contains=[tag],
                ).values_list("id", flat=True)
            )
            if not cohort_ids:
                continue
            cohort_size = len(cohort_ids)
            likes_total = CoursePostLike.objects.filter(post_id__in=cohort_ids).count()
            comments_total = (
                CoursePostComment.objects.filter(post_id__in=cohort_ids).count()
            )
            views_total = CoursePostView.objects.filter(post_id__in=cohort_ids).count()
            def _avg(total: int) -> float:
                return round(total / cohort_size, 2) if cohort_size else 0.0

            hashtags_data.append(
                {
                    "hashtag": tag,
                    "post": totals.copy(),
                    "average": {
                        "likes": _avg(likes_total),
                        "comments": _avg(comments_total),
                        "views": _avg(views_total),
                    },
                    "cohort_size": cohort_size,
                }
            )

    return {
        "post_id": post_id,
        "course_id": course_id,
        "range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days,
        },
        "totals": totals,
        "sentiment": {
            "counts": sentiment_counts,
            "percentages": sentiment_percentages,
            "total_comments": sentiment_total,
        },
        "series": {
            "likes": _build_series(like_map),
            "comments": _build_series(comment_map),
            "views": _build_series(view_map),
        },
        "hashtags": hashtags_data,
    }


def list_posts_by_user(*, user, target_user_id: int, limit: int | None = None) -> list[dict[str, Any]]:
    """Execute the `list_posts_by_user` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    # Context: Compute shared values once so all branches use the same normalized inputs.
    user_courses = CourseRepository.get_user_courses(user.id)
    member_course_ids = [c.id for c in user_courses]
    
    if not member_course_ids:
        return []

    # Context: Compute shared values once so all branches use the same normalized inputs.
    posts = PostRepository.get_user_posts(target_user_id, member_course_ids, limit=limit)
    
    if not posts:
        return []
    
    post_ids = [p.id for p in posts]

    # Context: Compute shared values once so all branches use the same normalized inputs.
    like_count_map = PostLikeRepository.get_like_counts(post_ids)
    liked_ids = PostLikeRepository.get_user_liked_posts(user.id, post_ids)
    comment_count_map = PostCommentRepository.get_comment_counts(post_ids)
    
    for p in posts:
        setattr(p, "prefetched_comments_count", comment_count_map.get(p.id, 0))

    return _serialize_posts(
        posts,
        liked_ids=liked_ids,
        like_counts=like_count_map,
        current_user=user,
    )


def list_liked_posts(*, user, target_user_id: int) -> list[dict[str, Any]]:
    """Execute the `list_liked_posts` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    # Context: Compute shared values once so all branches use the same normalized inputs.
    user_courses = CourseRepository.get_user_courses(user.id)
    member_course_ids = [c.id for c in user_courses]
    
    if not member_course_ids:
        return []

    # Context: Compute shared values once so all branches use the same normalized inputs.
    posts = PostRepository.get_liked_posts(target_user_id, member_course_ids)

    if not posts:
        return []
    
    post_ids = [p.id for p in posts]

    # Context: Compute shared values once so all branches use the same normalized inputs.
    like_count_map = PostLikeRepository.get_like_counts(post_ids)
    liked_ids = PostLikeRepository.get_user_liked_posts(user.id, post_ids)
    comment_count_map = PostCommentRepository.get_comment_counts(post_ids)
    
    for p in posts:
        setattr(p, "prefetched_comments_count", comment_count_map.get(p.id, 0))

    return _serialize_posts(
        posts,
        liked_ids=liked_ids,
        like_counts=like_count_map,
        current_user=user,
    )


def list_posts_with_analytics_by_user(
    *,
    user,
    target_user_id: int,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Execute the `list_posts_with_analytics_by_user` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    posts = list_posts_by_user(user=user, target_user_id=target_user_id, limit=limit)
    if not posts:
        return []

    post_ids = [item["id"] for item in posts]
    snapshots = PostAnalyticsSnapshotRepository.get_many_by_posts(post_ids)
    snapshot_map = {snap.post_id: snap for snap in snapshots}

    view_counts = {
        row["post_id"]: row["total"]
        for row in CoursePostView.objects.filter(post_id__in=post_ids)
        .values("post_id")
        .annotate(total=Count("id"))
    }

    enriched: list[dict[str, Any]] = []
    for item in posts:
        post_id = item["id"]
        snapshot = snapshot_map.get(post_id)

        if snapshot:
            totals = snapshot.totals or {}
            sentiment_pct = snapshot.sentiment_percentages or {}
            range_data = {
                "start": snapshot.range_start.isoformat() if snapshot.range_start else None,
                "end": snapshot.range_end.isoformat() if snapshot.range_end else None,
                "days": snapshot.range_days,
            }
        else:
            totals = {
                "likes": item.get("likes_count", 0),
                "comments": item.get("comments_count", 0),
                "views": view_counts.get(post_id, 0),
            }
            sentiment_pct = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
            range_data = None

        preview = item.get("content") or ""
        enriched.append(
            {
                "id": post_id,
                "course_id": item.get("course_id"),
                "content": item.get("content"),
                "title": preview[:60],
                "created_at": item.get("created_at"),
                "hashtags": item.get("hashtags", []),
                "likes": totals.get("likes", item.get("likes_count", 0)),
                "comments": totals.get("comments", item.get("comments_count", 0)),
                "views": totals.get("views", view_counts.get(post_id, 0)),
                "sentiment": {
                    "positive": float(sentiment_pct.get("positive", 0)),
                    "neutral": float(sentiment_pct.get("neutral", 0)),
                    "negative": float(sentiment_pct.get("negative", 0)),
                },
                "range": range_data,
            }
        )

    return enriched


def _schedule_interest_recommendations(
    course_id: int,
    post_id: int,
    excluded_user_ids: list[int] | None = None,
) -> None:
    excluded = [uid for uid in (excluded_user_ids or []) if uid]
    threading.Thread(
        target=_run_interest_recommendations,
        args=(course_id, post_id, excluded),
        name=f"post-recs-{course_id}-{post_id}",
        daemon=True,
    ).start()


def _run_interest_recommendations(course_id: int, post_id: int, excluded_user_ids: list[int]) -> None:
    try:
        _handle_interest_recommendations(course_id, post_id, set(excluded_user_ids))
    except Exception:  # noqa: BLE001
        logger.exception("Interest recommendation task failed for course=%s post=%s", course_id, post_id)


def _handle_interest_recommendations(
    course_id: int,
    post_id: int,
    excluded_user_ids: set[int],
) -> None:
    try:
        post = CoursePost.objects.select_related("course", "author").get(id=post_id, course_id=course_id)
    except CoursePost.DoesNotExist:
        return

    hashtags = [str(tag).strip().lower() for tag in (post.hashtags or []) if str(tag).strip()]
    if not hashtags:
        return

    excluded = set(excluded_user_ids)
    if post.author_id:
        excluded.add(post.author_id)

    recommendations = _gather_interest_recommendations(post, hashtags, excluded)
    if not recommendations:
        return

    actor_name = _display_name(post.author)
    course = post.course
    if not course:
        return
    post_preview = (post.content or "").strip()[:140]
    subject = "A post you might like"
    link = f"/courses/{course_id}/posts/{post.id}"
    for entry in recommendations:
        user_obj = entry["user"]
        recipient = (
            (user_obj.username or "").strip()
            or (user_obj.email or "").strip()
            or str(user_obj.id)
        )
        if not recipient:
            continue
        reason = entry.get("reason", "")
        body = (
            f"{actor_name} just posted in {course.course_code}. "
            f"{post_preview}"
        ).strip()
        create_notification(
            recipient=recipient,
            actor=actor_name,
            action="recommended_post",
            subject=subject,
            body=body,
            link=link,
            metadata={
                "course_id": course_id,
                "course_code": course.course_code,
                "course_name": course.name,
                "post_id": post.id,
                "post_preview": post_preview,
                "recommended": True,
                "reason": reason,
            },
        )


def _gather_interest_recommendations(
    post: CoursePost,
    hashtags: list[str],
    excluded_user_ids: set[int],
) -> list[dict[str, Any]]:
    now = timezone.now()
    cutoff = now - timedelta(days=RECOMMENDATION_WINDOW_DAYS)
    normalized_tags = [tag for tag in hashtags if tag]
    if not normalized_tags:
        return []

    scores: dict[int, float] = defaultdict(float)
    reasons: dict[int, list[str]] = defaultdict(list)

    def _add_candidate(user_id: int | None, base_score: float, reason: str, created_at=None) -> None:
        if not user_id or user_id in excluded_user_ids:
            return
        weight = base_score
        if created_at:
            weight *= 1.0 + _recency_weight(created_at, now)
        scores[user_id] += weight
        if reason:
            reasons[user_id].append(reason)

    for tag in normalized_tags:
        like_rows = (
            CoursePostLike.objects.filter(
                post__course_id=post.course_id,
                created_at__gte=cutoff,
                post__hashtags__contains=[tag],
            )
            .exclude(user_id__in=excluded_user_ids)
            .values_list("user_id", "created_at")
        )
        for user_id, created_at in like_rows:
            _add_candidate(user_id, 1.0, f"recent likes #{tag}", created_at)

        comment_rows = (
            CoursePostComment.objects.filter(
                post__course_id=post.course_id,
                created_at__gte=cutoff,
                post__hashtags__contains=[tag],
            )
            .exclude(user_id__in=excluded_user_ids)
            .values_list("user_id", "created_at")
        )
        for user_id, created_at in comment_rows:
            _add_candidate(user_id, 1.3, f"recent comments #{tag}", created_at)

    normalized_set = set(normalized_tags)
    profile_qs = (
        CourseProfileRepository.model.objects.filter(course_id=post.course_id)
        .exclude(user_id__in=excluded_user_ids)
        .select_related("user")
    )
    profile_map: dict[int, Any] = {}
    for profile in profile_qs:
        profile_map[profile.user_id] = profile
        tokens = _collect_profile_tokens(profile)
        matched = normalized_set.intersection(tokens)
        if matched:
            tags_text = ", ".join(f"#{item}" for item in sorted(matched))
            _add_candidate(profile.user_id, 0.8, f"profile interests include {tags_text}")

    if not scores:
        return []

    sorted_candidates = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    candidate_ids = [user_id for user_id, _ in sorted_candidates[: MAX_RECOMMENDATIONS * 3]]
    if not candidate_ids:
        return []
    user_map = {
        user.id: user
        for user in get_user_model()
        .objects.filter(id__in=candidate_ids)
        .only("id", "username", "email", "first_name", "last_name")
    }

    recommendations: list[dict[str, Any]] = []
    for user_id, _score in sorted_candidates:
        if len(recommendations) >= MAX_RECOMMENDATIONS:
            break
        if user_id not in user_map:
            continue
        profile = profile_map.get(user_id)
        if profile is None:
            profile = (
                CourseProfileRepository.model.objects.filter(
                    course_id=post.course_id,
                    user_id=user_id,
                )
                .select_related("user")
                .first()
            )
            if profile:
                profile_map[user_id] = profile
        if not _evaluate_profile_interest(profile, post):
            continue
        reason_text = "; ".join(reasons.get(user_id) or []) or "profile match"
        recommendations.append({"user": user_map[user_id], "reason": reason_text})

    return recommendations


def _collect_profile_tokens(profile) -> set[str]:
    tokens: set[str] = set()
    for value in profile.interests or []:
        if value:
            tokens.add(str(value).strip().lower())
    for attr in [
        "content_preference",
        "shopping_preference",
        "decision_factor",
        "interaction_style",
        "influencer_type",
    ]:
        value = getattr(profile, attr, "")
        if value:
            tokens.add(str(value).strip().lower())
    return tokens


def _build_profile_prompt(profile, post: CoursePost) -> str:
    user = getattr(profile, "user", None)
    display_name = ""
    if user:
        display_name = (
            user.get_full_name()
            or user.username
            or (user.email.split("@")[0] if user.email else "")
            or f"user{user.pk}"
        )
    persona_lines = [
        f"Display Name: {display_name or 'Unknown'}",
        f"Gender: {profile.gender or 'Unknown'}",
        f"City: {profile.city or 'Unknown'}",
        f"Age Group: {profile.age_group or 'Unknown'}",
        f"Education: {profile.education_level or 'Unknown'}",
        f"Income Level: {profile.income_level or 'Unknown'}",
        f"Interests: {', '.join(profile.interests) if profile.interests else 'None'}",
        f"Social Value (1-10): {profile.social_value or 5}",
        f"Sociability (1-10): {profile.sociability or 5}",
        f"Openness (1-10): {profile.openness or 5}",
        f"Preferred Content: {profile.content_preference or 'Unknown'}",
        f"Shopping Frequency: {profile.shopping_frequency or 'Unknown'}",
        f"Buying Behavior: {profile.buying_behavior or 'Unknown'}",
        f"Decision Factor: {profile.decision_factor or 'Unknown'}",
        f"Interaction Style: {profile.interaction_style or 'Unknown'}",
        f"Influencer Type: {profile.influencer_type or 'Unknown'}",
    ]
    course_info = (
        f"{post.course.course_code} - {post.course.name}" if post.course else "the course"
    )
    hashtags = ", ".join(f"#{tag}" for tag in (post.hashtags or []))
    return (
        "You are evaluating whether a real student persona would be interested in a course discussion post.\n"
        f"{chr(10).join(persona_lines)}\n\n"
        f"Course: {course_info}\n"
        f"Post hashtags: {hashtags or 'None'}\n"
        "Respond strictly in JSON with keys `interested` (bool), `like` (bool), `comment` (string). "
        "Leave comment empty when not applicable.\n\n"
        f'Post content:\n"""{post.content}"""\n'
    )


def _evaluate_profile_interest(profile, post: CoursePost) -> bool:
    if profile is None:
        return False
    prompt = _build_profile_prompt(profile, post)
    decision = evaluate_persona_prompt(prompt)
    if decision is None:
        return True
    return bool(decision.interested)


def _recency_weight(event_time, now) -> float:
    if not event_time:
        return 0.0
    window_seconds = RECOMMENDATION_WINDOW_DAYS * 86400
    age_seconds = max(0.0, (now - event_time).total_seconds())
    freshness = max(0.0, window_seconds - age_seconds)
    return freshness / window_seconds if window_seconds else 0.0


__all__ = [
    "CourseAccessError",
    "CoursePostNotFoundError",
    "CourseReadOnlyError",
    "list_course_posts",
    "create_course_post",
    "create_course_post_with_meta",
    "update_course_post",
    "delete_course_post",
    "like_course_post",
    "unlike_course_post",
    "get_course_post_detail",
    "list_posts_by_user",
    "list_liked_posts",
    "get_course_post_analytics",
    "MAX_POST_ATTACHMENTS",
    "search_course_mentions",
    "search_course_hashtags",
]
