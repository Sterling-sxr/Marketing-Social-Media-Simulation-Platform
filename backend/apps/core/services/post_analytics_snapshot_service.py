"""Background refresh tasks for post analytics snapshots."""
from __future__ import annotations

import logging
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from ..repositories import (
    CoursePost,
    CoursePostComment,
    CoursePostLike,
    CoursePostView,
    PostAnalyticsSnapshot,
    PostAnalyticsSnapshotRepository,
)
from .dashboard_service import classify_comment_sentiment

_logger = logging.getLogger(__name__)
_refresh_lock = threading.Lock()
_scheduler_started = False


def _calculate_post_snapshot(post: CoursePost, *, days: int = 7) -> PostAnalyticsSnapshot:
    course = post.course  # already fetched
    end_date = timezone.localdate()
    start_date = end_date - timedelta(days=days - 1)

    totals = {
        "likes": CoursePostLike.objects.filter(post_id=post.id).count(),
        "comments": CoursePostComment.objects.filter(post_id=post.id).count(),
        "views": CoursePostView.objects.filter(post_id=post.id).count(),
    }

    _logger.debug(
        "[PostAnalytics] computing snapshot",
        extra={"post_id": post.id, "course_id": course.id if course else None},
    )

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    if totals["comments"]:
        for content in CoursePostComment.objects.filter(post_id=post.id).values_list("content", flat=True):
            try:
                label = classify_comment_sentiment(content or "")
            except Exception:
                label = "neutral"
            sentiment_counts[label] = sentiment_counts.get(label, 0) + 1

    total_comments = sum(sentiment_counts.values())
    if total_comments:
        sentiment_percentages = {
            key: round(value * 100 / total_comments, 1)
            for key, value in sentiment_counts.items()
        }
    else:
        sentiment_percentages = {key: 0.0 for key in sentiment_counts}

    snapshot, _created = PostAnalyticsSnapshotRepository.update_or_create(
        defaults={
            "course": course,
            "totals": totals,
            "sentiment_counts": sentiment_counts,
            "sentiment_percentages": sentiment_percentages,
            "range_start": start_date,
            "range_end": end_date,
            "range_days": days,
        },
        post=post,
    )
    return snapshot


def refresh_post_snapshot(post: CoursePost, *, days: int = 7) -> None:
    try:
        _calculate_post_snapshot(post, days=days)
        _logger.debug("[PostAnalytics] snapshot refreshed", extra={"post_id": post.id})
    except Exception:  # noqa: BLE001
        _logger.exception("Failed to refresh analytics snapshot for post=%s", post.id)


def refresh_all_post_snapshots(*, days: int = 7) -> None:
    posts = (
        CoursePost.objects.select_related("course")
        .all()
        .order_by("-created_at")
    )
    posts = list(posts)
    total = len(posts)
    if total == 0:
        _logger.info("Post analytics refresh skipped: no posts found")
        return
    _logger.info("===== POST ANALYTICS REFRESH START ===== (posts=%s, days=%s)", total, days)
    for post in posts:
        refresh_post_snapshot(post, days=days)
    _logger.info("===== POST ANALYTICS REFRESH END ===== (posts=%s, days=%s)", total, days)


def refresh_all_post_snapshots_async(delay_seconds: int = 0, days: int = 7) -> None:
    def _task():
        if delay_seconds:
            time.sleep(delay_seconds)
        with _refresh_lock:
            try:
                _logger.info(
                    "===== POST ANALYTICS ASYNC TRIGGER ===== (delay=%s, days=%s)",
                    delay_seconds,
                    days,
                )
                refresh_all_post_snapshots(days=days)
            except Exception:  # noqa: BLE001
                _logger.exception("Asynchronous refresh_all_post_snapshots failed")

    threading.Thread(
        target=_task,
        name="post-analytics-refresh-all",
        daemon=True,
    ).start()


def start_post_analytics_scheduler() -> None:
    global _scheduler_started
    if _scheduler_started:
        return
    interval = int(
        getattr(settings, "POST_ANALYTICS_REFRESH_INTERVAL", 3600)
    )
    _logger.info("Starting post analytics scheduler (interval=%s seconds)", interval)
    refresh_all_post_snapshots_async(delay_seconds=5)

    def _loop():
        while True:
            time.sleep(interval)
            refresh_all_post_snapshots_async(days=7)

    threading.Thread(target=_loop, name="post-analytics-scheduler", daemon=True).start()
    _scheduler_started = True


__all__ = [
    "refresh_all_post_snapshots",
    "refresh_all_post_snapshots_async",
    "start_post_analytics_scheduler",
    "refresh_post_snapshot",
]
