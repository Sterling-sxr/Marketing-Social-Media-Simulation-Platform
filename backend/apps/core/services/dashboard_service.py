from __future__ import annotations

import logging
import os
import threading
import time
from datetime import timedelta
from typing import Any

import torch
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

from ..repositories import (
    CourseMemberRepository,
    CourseRepository,
    PostCommentRepository,
    PostLikeRepository,
    PostRepository,
    PostViewRepository,
)
from ..repositories.models import (
    CourseDashboardSnapshot,
    CourseHashtagDashboardSnapshot,
    CoursePostComment,
    CourseStudentDashboardSnapshot,
    DashboardSnapshot,
)

_sentiment_pipeline = None
_scheduler_started = False
_logger = logging.getLogger(__name__)
_refreshing_users: set[int] = set()
_refresh_users_lock = threading.Lock()
_DEFAULT_SNAPSHOT_TTL_SECONDS = 900


def _ensure_admin(user) -> None:
    if not (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)):
        raise PermissionError("Only administrators can access the dashboard.")


def _is_admin(user) -> bool:
    return bool(getattr(user, "is_superuser", False) or getattr(user, "is_staff", False))


def _is_teacher_for_course(user, course_id: int) -> bool:
    user_id = getattr(user, "id", None)
    if user_id is None:
        return False
    return CourseMemberRepository.model.objects.filter(
        course_id=course_id,
        user_id=user_id,
        role="teacher",
    ).exists()


def _get_accessible_course(user, course_id: int):
    course = CourseRepository.model.objects.filter(id=course_id).first()
    if not course:
        return None

    if _is_admin(user):
        if course.created_by_id == user.id or getattr(user, "is_superuser", False):
            return course
        return None

    if _is_teacher_for_course(user, course_id):
        return course

    return None


def _get_snapshot_ttl_seconds() -> int:
    raw_value = os.environ.get(
        "DASHBOARD_SNAPSHOT_TTL_SECONDS",
        str(_DEFAULT_SNAPSHOT_TTL_SECONDS),
    )
    try:
        return max(int(raw_value), 0)
    except (TypeError, ValueError):
        return _DEFAULT_SNAPSHOT_TTL_SECONDS


def _is_snapshot_fresh(snapshot) -> bool:
    if not snapshot or not getattr(snapshot, "calculated_at", None):
        return False
    ttl_seconds = _get_snapshot_ttl_seconds()
    if ttl_seconds == 0:
        return False
    age = timezone.now() - snapshot.calculated_at
    return age <= timedelta(seconds=ttl_seconds)


def _apply_source_status(
    payload: dict[str, Any],
    *,
    source_kind: str,
    source_status: str,
) -> dict[str, Any]:
    next_payload = dict(payload)
    next_payload["source_kind"] = source_kind
    next_payload["source_status"] = source_status
    next_payload["refreshing"] = source_kind == "fallback_placeholder"
    return next_payload


def _get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        model_name = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
        tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=False,
        )
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model=model,
            tokenizer=tokenizer,
            device=-1,
            return_all_scores=False,
        )
    return _sentiment_pipeline


def classify_comment_sentiment(text: str) -> str:
    """Public helper that returns the sentiment label for a given comment."""
    return _classify_sentiment(text)


def _normalize_sentiment_label(raw: str) -> str:
    label = (raw or "").lower()
    if "positive" in label:
        return "positive"
    if "negative" in label:
        return "negative"
    return "neutral"


def _extract_sentiment_label(result: Any) -> str:
    if isinstance(result, dict):
        return str(result.get("label") or "")
    if isinstance(result, (list, tuple)) and result:
        first = result[0]
        if isinstance(first, dict):
            return str(first.get("label") or "")
        if isinstance(first, str):
            return first
    if isinstance(result, str):
        return result
    return ""


def _classify_sentiment(text: str) -> str:
    classifier = _get_sentiment_pipeline()
    try:
        result = classifier(text[:512] or "")[0]
    except Exception:
        return "neutral"
    return _normalize_sentiment_label(_extract_sentiment_label(result))


def _summarize_sentiment(counts: dict[str, int]) -> dict[str, Any]:
    total = sum(counts.values())
    breakdown = {key: round(value * 100 / total, 1) if total else 0.0 for key, value in counts.items()}
    if total:
        top_label = max(breakdown, key=lambda k: (breakdown[k], k))
        top_percent = breakdown.get(top_label, 0.0)
    else:
        top_label = "neutral"
        top_percent = 0.0
    return {
        "top_label": top_label,
        "top_percent": top_percent,
        "breakdown": breakdown,
        "total_comments": total,
    }


def _calculate_dashboard_metrics(user) -> dict[str, Any]:
    today = timezone.localdate()
    courses = CourseRepository.filter(created_by_id=user.id)
    if not courses:
        return {
            "total_courses": 0,
            "active_courses": 0,
            "registered_students": 0,
            "total_posts": 0,
            "total_interactions": 0,
            "sentiment": {
                "positive": 0,
                "neutral": 0,
                "negative": 0,
            },
        }

    total_courses = len(courses)
    course_ids = [c.id for c in courses]
    active_courses = sum(1 for c in courses if getattr(c, "end_date", None) is None or c.end_date >= today)

    members = CourseMemberRepository.model.objects.filter(
        course_id__in=course_ids,
        role="student",
    ).values_list("user_id", flat=True)
    registered_students = len(set(members))

    posts = PostRepository.model.objects.filter(course_id__in=course_ids)
    post_ids = list(posts.values_list("id", flat=True))
    total_posts = len(post_ids)

    total_likes = PostLikeRepository.model.objects.filter(post_id__in=post_ids).count()
    total_comments = PostCommentRepository.model.objects.filter(post_id__in=post_ids).count()
    total_interactions = total_likes + total_comments

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    if total_comments:
        classifier = _get_sentiment_pipeline()
        comment_texts = list(CoursePostComment.objects.filter(post_id__in=post_ids).values_list("content", flat=True))
        # Per-item classification to avoid a single failure wiping the batch
        for text in comment_texts:
            try:
                result = classifier([text[:512] or ""])[0]
                label = (result.get("label") or "").lower()
            except Exception:
                label = "neutral"

            if "positive" in label:
                sentiment_counts["positive"] += 1
            elif "negative" in label:
                sentiment_counts["negative"] += 1
            else:
                sentiment_counts["neutral"] += 1

    total_comment_count = sum(sentiment_counts.values())
    if total_comment_count:
        sentiment_percentages = {key: round(value * 100 / total_comment_count, 1) for key, value in sentiment_counts.items()}
    else:
        sentiment_percentages = {key: 0 for key in sentiment_counts}

    return {
        "total_courses": total_courses,
        "active_courses": active_courses,
        "registered_students": registered_students,
        "total_posts": total_posts,
        "total_interactions": total_interactions,
        "sentiment": sentiment_percentages,
        "refreshing": False,
    }


def _change_percentage(current: int, previous: int) -> float:
    if previous <= 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) * 100 / previous, 1)


def _get_post_interactions(
    post_ids: list[int],
) -> tuple[dict[int, int], int, dict[int, int], dict[int, int]]:
    from django.db.models import Count

    like_counts = {
        item["post_id"]: item["total"]
        for item in PostLikeRepository.model.objects.filter(post_id__in=post_ids).values("post_id").annotate(total=Count("id"))
    }
    comment_counts = {
        item["post_id"]: item["total"]
        for item in PostCommentRepository.model.objects.filter(post_id__in=post_ids).values("post_id").annotate(total=Count("id"))
    }
    interactions_per_post: dict[int, int] = {}
    total_interactions = 0
    for pid in post_ids:
        interactions = like_counts.get(pid, 0) + comment_counts.get(pid, 0)
        interactions_per_post[pid] = interactions
        total_interactions += interactions
    return interactions_per_post, total_interactions, like_counts, comment_counts


def _collect_course_post_data(course) -> dict[str, Any]:
    posts_qs = PostRepository.model.objects.filter(course_id=course.id)
    post_records = list(posts_qs.values("id", "author_id", "hashtags", "created_at", "content"))
    post_ids = [record["id"] for record in post_records]

    (
        interactions_per_post,
        total_interactions,
        like_counts,
        comment_counts,
    ) = _get_post_interactions(post_ids)

    from django.db.models import Count

    view_counts = {
        item["post_id"]: item["total"]
        for item in PostViewRepository.model.objects.filter(post_id__in=post_ids).values("post_id").annotate(total=Count("id"))
    }

    comment_records = list(CoursePostComment.objects.filter(post_id__in=post_ids).values("post_id", "content"))
    comment_sentiments: dict[int, dict[str, int]] = {pid: {"positive": 0, "neutral": 0, "negative": 0} for pid in post_ids}
    if comment_records:
        classifier = _get_sentiment_pipeline()
        chunk_size = 16
        for chunk_start in range(0, len(comment_records), chunk_size):
            chunk = comment_records[chunk_start : chunk_start + chunk_size]
            texts = [(record.get("content") or "")[:512] for record in chunk]
            try:
                results = classifier(texts)
            except Exception:
                results = [None] * len(chunk)
            for record, result in zip(chunk, results):
                label = _normalize_sentiment_label(_extract_sentiment_label(result))
                post_id = record["post_id"]
                post_stats = comment_sentiments.setdefault(
                    post_id,
                    {"positive": 0, "neutral": 0, "negative": 0},
                )
                post_stats[label] = post_stats.get(label, 0) + 1

    total_likes = sum(like_counts.values())
    total_comments = sum(comment_counts.values())
    total_views = sum(view_counts.values())

    return {
        "post_records": post_records,
        "post_ids": post_ids,
        "total_posts": len(post_records),
        "interactions_per_post": interactions_per_post,
        "total_interactions": total_interactions,
        "like_counts": like_counts,
        "total_likes": total_likes,
        "comment_counts": comment_counts,
        "total_comments": total_comments,
        "view_counts": view_counts,
        "total_views": total_views,
        "comment_sentiments": comment_sentiments,
    }


def _get_registered_student_count(course_id: int) -> int:
    members = CourseMemberRepository.model.objects.filter(
        course_id=course_id,
        role="student",
    ).values_list("user_id", flat=True)
    return len(set(members))


def _calculate_course_metrics_from_data(course, course_data: dict[str, Any]) -> dict[str, Any]:
    post_records = course_data["post_records"]
    interactions_per_post = course_data["interactions_per_post"]
    comment_sentiments = course_data["comment_sentiments"]
    registered_students = _get_registered_student_count(course.id)
    now = timezone.now()
    current_start = now - timedelta(days=7)
    previous_start = now - timedelta(days=14)

    hashtag_stats: dict[str, dict[str, Any]] = {}
    student_stats: dict[int, dict[str, Any]] = {}

    # Sentiment totals for the whole course (no time window)
    course_sentiment_totals = {"positive": 0, "neutral": 0, "negative": 0}
    for _, sentiment_counts in comment_sentiments.items():
        for label, count in sentiment_counts.items():
            course_sentiment_totals[label] = course_sentiment_totals.get(label, 0) + count
    course_sentiment_summary = _summarize_sentiment(course_sentiment_totals)

    for record in post_records:
        post_id = record["id"]
        created_at = record["created_at"]
        author_id = record["author_id"]
        post_interactions = interactions_per_post.get(post_id, 0)
        post_sentiment = comment_sentiments.get(
            post_id,
            {"positive": 0, "neutral": 0, "negative": 0},
        )

        normalized_hashtags = [str(tag).strip() for tag in (record.get("hashtags") or []) if str(tag).strip()]
        current_week = created_at >= current_start
        previous_week = previous_start <= created_at < current_start

        for tag in normalized_hashtags:
            stats = hashtag_stats.setdefault(
                tag,
                {
                    "posts_total": 0,
                    "interactions_total": 0,
                    "current_week_posts": 0,
                    "previous_week_posts": 0,
                    "sentiment_counts": {"positive": 0, "neutral": 0, "negative": 0},
                },
            )
            stats["posts_total"] += 1
            stats["interactions_total"] += post_interactions
            if current_week:
                stats["current_week_posts"] += 1
            elif previous_week:
                stats["previous_week_posts"] += 1
            for sentiment_label, count in post_sentiment.items():
                stats["sentiment_counts"][sentiment_label] = stats["sentiment_counts"].get(sentiment_label, 0) + count

        student = student_stats.setdefault(
            author_id,
            {
                "posts_total": 0,
                "interactions_total": 0,
                "current_week_posts": 0,
                "previous_week_posts": 0,
                "sentiment_counts": {"positive": 0, "neutral": 0, "negative": 0},
            },
        )
        student["posts_total"] += 1
        student["interactions_total"] += post_interactions
        if current_week:
            student["current_week_posts"] += 1
        elif previous_week:
            student["previous_week_posts"] += 1
        for sentiment_label, count in post_sentiment.items():
            student["sentiment_counts"][sentiment_label] = student["sentiment_counts"].get(sentiment_label, 0) + count

    hashtag_list = []
    for tag, stats in hashtag_stats.items():
        sentiment_summary = _summarize_sentiment(stats["sentiment_counts"])
        hashtag_list.append(
            {
                "hashtag": tag,
                "total_posts": stats["posts_total"],
                "total_interactions": stats["interactions_total"],
                "change_percent": _change_percentage(stats["current_week_posts"], stats["previous_week_posts"]),
                "sentiment": sentiment_summary,
            }
        )
    hashtag_list.sort(key=lambda item: item["total_posts"], reverse=True)
    hashtag_list = hashtag_list[:10]

    User = get_user_model()
    user_map = {user.id: user for user in User.objects.filter(id__in=student_stats.keys())}

    student_list = []
    for user_id, stats in student_stats.items():
        user = user_map.get(user_id)
        if not user:
            continue
        sentiment_summary = _summarize_sentiment(stats["sentiment_counts"])
        name = user.get_full_name().strip() or user.username or user.email or f"user-{user_id}"
        student_list.append(
            {
                "user_id": user_id,
                "name": name,
                "posts_total": stats["posts_total"],
                "interactions_total": stats["interactions_total"],
                "change_percent": _change_percentage(stats["current_week_posts"], stats["previous_week_posts"]),
                "sentiment": sentiment_summary,
            }
        )
    student_list.sort(key=lambda item: item["posts_total"], reverse=True)
    student_list = student_list[:10]

    summary = {
        "total_posts": course_data["total_posts"],
        "total_interactions": course_data["total_interactions"],
        "registered_students": registered_students,
    }

    return {
        "summary": summary,
        "sentiment": course_sentiment_summary,
        "hashtags": hashtag_list,
        "students": student_list,
    }


def _calculate_course_metrics(course) -> tuple[dict[str, Any], dict[str, Any]]:
    course_data = _collect_course_post_data(course)
    metrics = _calculate_course_metrics_from_data(course, course_data)
    return metrics, course_data


def _placeholder_dashboard_data() -> dict[str, Any]:
    return _apply_source_status({
        "refreshing": True,
        "calculated_at": None,
        "total_courses": 0,
        "registered_students": 0,
        "total_posts": 0,
        "total_interactions": 0,
        "sentiment": {"positive": 0, "neutral": 0, "negative": 0},
        "courses": [],
    }, source_kind="fallback_placeholder", source_status="placeholder")


def _placeholder_course_data(course) -> dict[str, Any]:
    course_info = {
        "id": getattr(course, "id", None),
        "name": getattr(course, "name", ""),
        "course_code": getattr(course, "course_code", ""),
        "term": getattr(course, "term", ""),
    }
    return _apply_source_status({
        "refreshing": True,
        "calculated_at": None,
        "course": course_info,
        "summary": {
            "total_posts": 0,
            "total_interactions": 0,
            "registered_students": 0,
        },
        "sentiment": {
            "top_label": "neutral",
            "top_percent": 0,
            "breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "total_comments": 0,
        },
        "hashtags": [],
        "students": [],
    }, source_kind="fallback_placeholder", source_status="placeholder")


def _normalize_hashtag(value: str) -> str:
    return str(value or "").strip().lower()


def _placeholder_hashtag_data(course, hashtag: str) -> dict[str, Any]:
    course_info = {
        "id": getattr(course, "id", None),
        "name": getattr(course, "name", ""),
        "course_code": getattr(course, "course_code", ""),
        "term": getattr(course, "term", ""),
    }
    return _apply_source_status({
        "refreshing": True,
        "calculated_at": None,
        "course": course_info,
        "hashtag": hashtag,
        "summary": {
            "total_posts": 0,
            "total_likes": 0,
            "total_comments": 0,
            "total_views": 0,
            "total_interactions": 0,
        },
        "sentiment": {
            "top_label": "neutral",
            "top_percent": 0,
            "breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "total_comments": 0,
        },
        "top_posts": [],
    }, source_kind="fallback_placeholder", source_status="placeholder")


def _placeholder_student_data(course, student_id: int, student=None) -> dict[str, Any]:
    course_info = {
        "id": getattr(course, "id", None),
        "name": getattr(course, "name", ""),
        "course_code": getattr(course, "course_code", ""),
        "term": getattr(course, "term", ""),
    }
    if student is None and student_id:
        student = get_user_model().objects.filter(id=student_id).first()
    if student:
        student_name = student.get_full_name().strip() or student.username or student.email or f"user-{student_id}"
        student_email = student.email or ""
    else:
        student_name = f"user-{student_id}" if student_id else ""
        student_email = ""
    return _apply_source_status({
        "refreshing": True,
        "calculated_at": None,
        "course": course_info,
        "student": {"id": student_id, "name": student_name, "email": student_email},
        "summary": {
            "total_posts": 0,
            "total_likes": 0,
            "total_comments": 0,
            "total_views": 0,
            "total_interactions": 0,
        },
        "sentiment": {
            "top_label": "neutral",
            "top_percent": 0,
            "breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "total_comments": 0,
        },
        "top_posts": [],
    }, source_kind="fallback_placeholder", source_status="placeholder")


def refresh_course_snapshot(course) -> dict[str, Any]:
    metrics, course_data = _calculate_course_metrics(course)
    today = timezone.localdate()
    course_info = {
        "id": course.id,
        "name": course.name,
        "course_code": course.course_code,
        "term": course.term,
        "active": bool(getattr(course, "end_date", None) is None or course.end_date >= today),
    }
    payload = {**metrics, "course": course_info, "refreshing": False}
    snapshot, _ = CourseDashboardSnapshot.objects.update_or_create(
        course=course,
        defaults={"data": payload, "calculated_at": timezone.now()},
    )
    snapshot.refresh_from_db(fields=["data", "calculated_at"])
    result = dict(snapshot.data)
    result["calculated_at"] = snapshot.calculated_at.isoformat()
    result = _apply_source_status(
        result,
        source_kind="backend_snapshot",
        source_status="refreshed",
    )
    try:
        _refresh_course_hashtag_snapshots(course, course_data)
    except Exception:
        _logger.exception("Failed to refresh hashtag snapshots for course=%s", course.id)
    try:
        _refresh_course_student_snapshots(course, course_data)
    except Exception:
        _logger.exception("Failed to refresh student snapshots for course=%s", course.id)
    return result


def _get_course_snapshot_payload(course) -> dict[str, Any] | None:
    snapshot = CourseDashboardSnapshot.objects.filter(course=course).first()
    if not snapshot:
        return None
    payload = dict(snapshot.data)
    payload["calculated_at"] = snapshot.calculated_at.isoformat()
    return _apply_source_status(
        payload,
        source_kind="backend_snapshot",
        source_status="fresh" if _is_snapshot_fresh(snapshot) else "stale",
    )


def _ensure_course_snapshot(course) -> dict[str, Any]:
    snapshot_payload = _get_course_snapshot_payload(course)
    if snapshot_payload and snapshot_payload.get("source_status") == "fresh":
        return snapshot_payload

    try:
        action = "refreshing" if snapshot_payload else "generating"
        _logger.info(
            "On-demand %s course dashboard snapshot for course=%s",
            action,
            course.id,
        )
        return refresh_course_snapshot(course)
    except Exception:
        _logger.exception("On-demand course snapshot refresh failed for course=%s", course.id)
        return _placeholder_course_data(course)


def _get_hashtag_snapshot_payload(course, normalized_hashtag: str) -> dict[str, Any] | None:
    snapshot = CourseHashtagDashboardSnapshot.objects.filter(
        course=course,
        hashtag=normalized_hashtag,
    ).first()
    if not snapshot:
        return None
    payload = dict(snapshot.data)
    payload["calculated_at"] = snapshot.calculated_at.isoformat()
    return _apply_source_status(
        payload,
        source_kind="backend_snapshot",
        source_status="fresh" if _is_snapshot_fresh(snapshot) else "stale",
    )


def _ensure_hashtag_snapshot(course, hashtag: str) -> dict[str, Any]:
    normalized = _normalize_hashtag(hashtag)
    if not normalized:
        raise ValueError("Hashtag is required.")

    snapshot_payload = _get_hashtag_snapshot_payload(course, normalized)
    if snapshot_payload and snapshot_payload.get("source_status") == "fresh":
        return snapshot_payload

    try:
        action = "refreshing" if snapshot_payload else "generating"
        _logger.info(
            "On-demand %s hashtag dashboard snapshot for course=%s hashtag=%s",
            action,
            course.id,
            normalized,
        )
        course_data = _collect_course_post_data(course)
        refresh_course_hashtag_snapshot(course, hashtag, course_data)
    except Exception:
        _logger.exception(
            "On-demand hashtag snapshot generation failed for course=%s hashtag=%s",
            course.id,
            normalized,
        )
        return _placeholder_hashtag_data(course, hashtag)

    snapshot_payload = _get_hashtag_snapshot_payload(course, normalized)
    if snapshot_payload:
        return _apply_source_status(
            snapshot_payload,
            source_kind="backend_snapshot",
            source_status="refreshed",
        )
    return _placeholder_hashtag_data(course, hashtag)


def _get_student_snapshot_payload(course, student_id: int) -> dict[str, Any] | None:
    snapshot = CourseStudentDashboardSnapshot.objects.filter(
        course=course,
        student_id=student_id,
    ).first()
    if not snapshot:
        return None
    payload = dict(snapshot.data)
    payload["calculated_at"] = snapshot.calculated_at.isoformat()
    return _apply_source_status(
        payload,
        source_kind="backend_snapshot",
        source_status="fresh" if _is_snapshot_fresh(snapshot) else "stale",
    )


def _ensure_student_snapshot(course, student_id: int) -> dict[str, Any]:
    snapshot_payload = _get_student_snapshot_payload(course, student_id)
    if snapshot_payload and snapshot_payload.get("source_status") == "fresh":
        return snapshot_payload

    student = get_user_model().objects.filter(id=student_id).first()
    try:
        action = "refreshing" if snapshot_payload else "generating"
        _logger.info(
            "On-demand %s student dashboard snapshot for course=%s student=%s",
            action,
            course.id,
            student_id,
        )
        course_data = _collect_course_post_data(course)
        refresh_course_student_snapshot(course, student_id, course_data)
    except Exception:
        _logger.exception(
            "On-demand student snapshot generation failed for course=%s student=%s",
            course.id,
            student_id,
        )
        return _placeholder_student_data(course, student_id, student)

    snapshot_payload = _get_student_snapshot_payload(course, student_id)
    if snapshot_payload:
        return _apply_source_status(
            snapshot_payload,
            source_kind="backend_snapshot",
            source_status="refreshed",
        )
    return _placeholder_student_data(course, student_id, student)


def refresh_dashboard_snapshot(user) -> dict[str, Any]:
    _ensure_admin(user)
    data = _calculate_dashboard_metrics(user)
    courses = CourseRepository.filter(created_by_id=user.id)
    course_summaries: list[dict[str, Any]] = []
    for course in courses:
        try:
            course_snapshot = refresh_course_snapshot(course)
        except Exception:
            _logger.exception("Failed to refresh course snapshot for course=%s", course.id)
            continue
        summary = course_snapshot.get("summary", {})
        info = course_snapshot.get("course", {})
        course_summaries.append(
            {
                "id": info.get("id", course.id),
                "name": info.get("name", course.name),
                "course_code": info.get("course_code", course.course_code),
                "term": info.get("term", course.term),
                "active": info.get("active"),
                "total_posts": summary.get("total_posts", 0),
                "total_interactions": summary.get("total_interactions", 0),
                "registered_students": summary.get("registered_students", 0),
                "calculated_at": course_snapshot.get("calculated_at"),
            }
        )

    data["courses"] = course_summaries
    data["total_courses"] = len(course_summaries)
    snapshot, _created = DashboardSnapshot.objects.update_or_create(
        user=user,
        defaults={"data": data, "calculated_at": timezone.now()},
    )
    snapshot.refresh_from_db(fields=["calculated_at", "data"])
    result = dict(snapshot.data)
    result["calculated_at"] = snapshot.calculated_at.isoformat()
    return result


def refresh_dashboard_snapshot_async(user) -> None:
    user_id = getattr(user, "id", None)
    if user_id is None:
        return
    with _refresh_users_lock:
        if user_id in _refreshing_users:
            return
        _refreshing_users.add(user_id)

    def _task():
        try:
            refresh_dashboard_snapshot(user)
        except Exception:
            _logger.exception("Asynchronous dashboard refresh failed for user=%s", user_id)
        finally:
            with _refresh_users_lock:
                _refreshing_users.discard(user_id)

    threading.Thread(
        target=_task,
        name=f"dashboard-refresh-user-{user_id}",
        daemon=True,
    ).start()


def refresh_course_hashtag_snapshot(course, hashtag: str, course_data: dict[str, Any]) -> None:
    normalized = _normalize_hashtag(hashtag)
    if not normalized:
        return
    metrics = _calculate_course_hashtag_metrics_from_data(course, course_data, hashtag)
    CourseHashtagDashboardSnapshot.objects.update_or_create(
        course=course,
        hashtag=normalized,
        defaults={"data": metrics, "calculated_at": timezone.now()},
    )


def _refresh_course_hashtag_snapshots(course, course_data: dict[str, Any]) -> None:
    hashtags: dict[str, str] = {}
    for record in course_data["post_records"]:
        for tag in record.get("hashtags") or []:
            normalized = _normalize_hashtag(tag)
            if not normalized:
                continue
            hashtags.setdefault(normalized, str(tag).strip())
    for normalized, original in hashtags.items():
        try:
            refresh_course_hashtag_snapshot(course, original, course_data)
        except Exception:
            _logger.exception(
                "Failed to refresh hashtag snapshot for course=%s hashtag=%s",
                course.id,
                original,
            )


def refresh_course_student_snapshot(course, student_id: int, course_data: dict[str, Any]) -> None:
    if not student_id:
        return
    metrics = _calculate_course_student_metrics_from_data(course, course_data, student_id)
    CourseStudentDashboardSnapshot.objects.update_or_create(
        course=course,
        student_id=student_id,
        defaults={"data": metrics, "calculated_at": timezone.now()},
    )


def _refresh_course_student_snapshots(course, course_data: dict[str, Any]) -> None:
    student_ids = {record.get("author_id") for record in course_data["post_records"] if record.get("author_id")}
    for student_id in student_ids:
        try:
            refresh_course_student_snapshot(course, student_id, course_data)
        except Exception:
            _logger.exception(
                "Failed to refresh student snapshot for course=%s student=%s",
                course.id,
                student_id,
            )


def refresh_course_snapshots_async(course_id: int) -> None:
    def _task():
        course = CourseRepository.model.objects.filter(id=course_id).first()
        if not course:
            return
        try:
            refresh_course_snapshot(course)
        except Exception:
            _logger.exception("Asynchronous course snapshot refresh failed for course=%s", course_id)

    threading.Thread(
        target=_task,
        name=f"dashboard-refresh-course-{course_id}",
        daemon=True,
    ).start()


def get_admin_dashboard(*, user) -> dict[str, Any]:
    _ensure_admin(user)
    snapshot = DashboardSnapshot.objects.filter(user=user).first()
    if snapshot:
        payload = dict(snapshot.data)
        payload["calculated_at"] = snapshot.calculated_at.isoformat()
        payload.setdefault("courses", [])
        payload.setdefault("total_courses", len(payload.get("courses", [])))
        return payload
    return _placeholder_dashboard_data()


def get_course_dashboard(*, user, course_id: int) -> dict[str, Any]:
    course = _get_accessible_course(user, course_id)
    if not course:
        raise PermissionError("Course not found or not managed by current user.")
    return _ensure_course_snapshot(course)


def get_course_hashtag_dashboard(*, user, course_id: int, hashtag: str) -> dict[str, Any]:
    course = _get_accessible_course(user, course_id)
    if not course:
        raise PermissionError("Course not found or not managed by current user.")
    return _ensure_hashtag_snapshot(course, hashtag)


def get_course_student_dashboard(*, user, course_id: int, student_id: int) -> dict[str, Any]:
    course = CourseRepository.model.objects.filter(id=course_id).first()
    if not course:
        raise ValueError("Course not found.")

    is_admin = _is_admin(user)
    if is_admin:
        if course.created_by_id != user.id and not getattr(user, "is_superuser", False):
            raise PermissionError("Course not managed by current user.")
    else:
        is_teacher = _is_teacher_for_course(user, course_id)
        if not is_teacher and user.id != student_id:
            raise PermissionError("You can only view your own analytics.")
        is_member = CourseMemberRepository.model.objects.filter(course_id=course_id, user_id=user.id).exists()
        if not is_member:
            raise PermissionError("You are not a member of this course.")

    target_member_exists = CourseMemberRepository.model.objects.filter(
        course_id=course_id,
        user_id=student_id,
    ).exists()
    if not target_member_exists:
        raise ValueError("Student not enrolled in this course.")

    return _ensure_student_snapshot(course, student_id)


def _calculate_course_hashtag_metrics_from_data(
    course,
    course_data: dict[str, Any],
    hashtag: str,
) -> dict[str, Any]:
    target = (hashtag or "").strip()
    if not target:
        raise ValueError("Hashtag is required.")
    normalized_target = _normalize_hashtag(target)
    matched_records: list[tuple[dict[str, Any], str]] = []
    display_hashtag = target
    for record in course_data["post_records"]:
        tags = [str(tag).strip() for tag in (record.get("hashtags") or []) if str(tag).strip()]
        for tag in tags:
            if _normalize_hashtag(tag) == normalized_target:
                matched_records.append((record, tag))
                if not display_hashtag:
                    display_hashtag = tag
                break

    post_ids = [record["id"] for record, _ in matched_records]
    like_counts = course_data["like_counts"]
    comment_counts = course_data["comment_counts"]
    view_counts = course_data["view_counts"]
    interactions_per_post = course_data["interactions_per_post"]
    sentiment_map = course_data["comment_sentiments"]

    total_likes = sum(like_counts.get(pid, 0) for pid in post_ids)
    total_comments = sum(comment_counts.get(pid, 0) for pid in post_ids)
    total_views = sum(view_counts.get(pid, 0) for pid in post_ids)
    total_interactions = sum(interactions_per_post.get(pid, 0) for pid in post_ids)

    sentiment_totals = {"positive": 0, "neutral": 0, "negative": 0}
    for pid in post_ids:
        for label, count in sentiment_map.get(pid, {"positive": 0, "neutral": 0, "negative": 0}).items():
            sentiment_totals[label] = sentiment_totals.get(label, 0) + count
    sentiment_summary = _summarize_sentiment(sentiment_totals)

    User = get_user_model()
    author_ids = {record["author_id"] for record, _ in matched_records}
    user_map = {user.id: user for user in User.objects.filter(id__in=author_ids)}

    top_posts = []
    for record, _tag in matched_records:
        pid = record["id"]
        author_id = record["author_id"]
        user = user_map.get(author_id)
        name = user.get_full_name().strip() or user.username or user.email or f"user-{author_id}" if user else f"user-{author_id}"
        interactions = interactions_per_post.get(pid, 0)
        content = (record.get("content") or "").strip()
        preview = content[:117].rstrip() + "..." if len(content) > 120 else content
        top_posts.append(
            {
                "post_id": pid,
                "author_id": author_id,
                "author_name": name,
                "preview": preview,
                "likes": like_counts.get(pid, 0),
                "comments": comment_counts.get(pid, 0),
                "views": view_counts.get(pid, 0),
                "interactions": interactions,
                "created_at": (record.get("created_at").isoformat() if hasattr(record.get("created_at"), "isoformat") else None),
            }
        )
    top_posts.sort(
        key=lambda item: (
            item["interactions"],
            item["likes"],
            item["comments"],
            item["views"],
            item["created_at"] or "",
        ),
        reverse=True,
    )
    top_posts = top_posts[:10]

    today = timezone.localdate()
    course_info = {
        "id": course.id,
        "name": course.name,
        "course_code": course.course_code,
        "term": course.term,
        "active": bool(getattr(course, "end_date", None) is None or course.end_date >= today),
    }

    summary = {
        "total_posts": len(post_ids),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_views": total_views,
        "total_interactions": total_interactions,
    }

    return {
        "refreshing": False,
        "course": course_info,
        "hashtag": display_hashtag,
        "summary": summary,
        "sentiment": sentiment_summary,
        "top_posts": top_posts,
    }


def _calculate_course_student_metrics_from_data(
    course,
    course_data: dict[str, Any],
    student_id: int,
) -> dict[str, Any]:
    student_posts = [record for record in course_data["post_records"] if record.get("author_id") == student_id]
    post_ids = [record["id"] for record in student_posts]
    like_counts = course_data["like_counts"]
    comment_counts = course_data["comment_counts"]
    view_counts = course_data["view_counts"]
    interactions_per_post = course_data["interactions_per_post"]
    sentiment_map = course_data["comment_sentiments"]

    total_likes = sum(like_counts.get(pid, 0) for pid in post_ids)
    total_comments = sum(comment_counts.get(pid, 0) for pid in post_ids)
    total_views = sum(view_counts.get(pid, 0) for pid in post_ids)
    total_interactions = sum(interactions_per_post.get(pid, 0) for pid in post_ids)

    sentiment_totals = {"positive": 0, "neutral": 0, "negative": 0}
    for pid in post_ids:
        for label, count in sentiment_map.get(pid, {"positive": 0, "neutral": 0, "negative": 0}).items():
            sentiment_totals[label] = sentiment_totals.get(label, 0) + count
    sentiment_summary = _summarize_sentiment(sentiment_totals)

    User = get_user_model()
    student = User.objects.filter(id=student_id).first()
    student_name = student.get_full_name().strip() or student.username or student.email or f"user-{student_id}" if student else f"user-{student_id}"

    top_posts = []
    for record in student_posts:
        pid = record["id"]
        interactions = interactions_per_post.get(pid, 0)
        content = (record.get("content") or "").strip()
        preview = content[:117].rstrip() + "..." if len(content) > 120 else content
        top_posts.append(
            {
                "post_id": pid,
                "author_id": student_id,
                "author_name": student_name,
                "preview": preview,
                "likes": like_counts.get(pid, 0),
                "comments": comment_counts.get(pid, 0),
                "views": view_counts.get(pid, 0),
                "interactions": interactions,
                "created_at": (record.get("created_at").isoformat() if hasattr(record.get("created_at"), "isoformat") else None),
            }
        )

    top_posts.sort(
        key=lambda item: (
            item["interactions"],
            item["likes"],
            item["comments"],
            item["views"],
            item["created_at"] or "",
        ),
        reverse=True,
    )
    top_posts = top_posts[:10]

    today = timezone.localdate()
    course_info = {
        "id": course.id,
        "name": course.name,
        "course_code": course.course_code,
        "term": course.term,
        "active": bool(getattr(course, "end_date", None) is None or course.end_date >= today),
    }

    summary = {
        "total_posts": len(post_ids),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_views": total_views,
        "total_interactions": total_interactions,
    }

    student_info = {
        "id": student_id,
        "name": student_name,
        "email": student.email if student else "",
    }

    return {
        "refreshing": False,
        "course": course_info,
        "student": student_info,
        "summary": summary,
        "sentiment": sentiment_summary,
        "top_posts": top_posts,
    }


def refresh_all_dashboards() -> None:
    User = get_user_model()
    admins = list(User.objects.filter(Q(is_superuser=True) | Q(is_staff=True)).distinct())
    total = len(admins)
    if total == 0:
        _logger.info("Dashboard refresh skipped: no admin or staff accounts found.")
        return
    _logger.info("===== DASHBOARD REFRESH START ===== (admins=%s)", total)
    success = 0
    for admin in admins:
        try:
            refresh_dashboard_snapshot(admin)
            success += 1
        except Exception:
            _logger.exception("Failed to refresh dashboard snapshot for admin=%s", admin.id)
    _logger.info(
        "===== DASHBOARD REFRESH END ===== (success=%s, failed=%s)",
        success,
        total - success,
    )


def refresh_all_dashboards_async(delay_seconds: int = 0) -> None:
    def _task():
        if delay_seconds:
            time.sleep(delay_seconds)
        try:
            _logger.info("===== DASHBOARD ASYNC TRIGGER ===== (delay=%s)", delay_seconds)
            refresh_all_dashboards()
        except Exception:
            _logger.exception("Asynchronous refresh_all_dashboards failed")

    threading.Thread(
        target=_task,
        name="dashboard-refresh-all",
        daemon=True,
    ).start()


def _scheduler_loop(interval_seconds: int) -> None:
    while True:
        time.sleep(interval_seconds)
        try:
            _logger.info("===== DASHBOARD SCHEDULER TICK ===== (interval=%s)", interval_seconds)
            refresh_all_dashboards()
        except Exception:
            _logger.exception("Scheduled dashboard refresh failed")


def start_dashboard_scheduler() -> None:
    global _scheduler_started
    if _scheduler_started:
        return
    if os.environ.get("DISABLE_DASHBOARD_SCHEDULER") == "1":
        return
    _scheduler_started = True
    interval = int(os.environ.get("DASHBOARD_REFRESH_INTERVAL", "3600"))
    # First run delayed by 60s after startup; subsequent runs every "interval" seconds.
    refresh_all_dashboards_async(delay_seconds=60)
    thread = threading.Thread(
        target=_scheduler_loop,
        args=(interval,),
        name="dashboard-refresh",
        daemon=True,
    )
    thread.start()
