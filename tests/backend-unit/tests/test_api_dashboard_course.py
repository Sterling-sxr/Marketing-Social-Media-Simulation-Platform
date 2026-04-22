from datetime import timedelta
import importlib
import sys

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.core.repositories.models import (
    Course,
    CourseDashboardSnapshot,
    CourseMember,
    CoursePost,
    CoursePostComment,
    CoursePostLike,
)


def _create_user(username: str, *, is_staff: bool = False):
    User = get_user_model()
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="password123",
        is_staff=is_staff,
    )


def _create_course(created_by):
    return Course.objects.create(
        name="Course Dashboard",
        course_code="COMP9900",
        term="26T1",
        join_code="COURSEDB1",
        start_date="2026-01-01",
        end_date="2026-12-31",
        created_by=created_by,
    )


def _load_dashboard_service():
    sys.modules.pop("apps.core.services.dashboard_service", None)
    return importlib.import_module("apps.core.services.dashboard_service")


def test_course_dashboard_counts_posts_outside_default_7_day_refresh_window(db):
    admin = _create_user("admin-dashboard", is_staff=True)
    student = _create_user("student-dashboard")
    course = _create_course(admin)
    CourseMember.objects.create(course=course, user=student, role="student")

    post = CoursePost.objects.create(
        course=course,
        author=student,
        content="Older course activity should still appear on the course dashboard.",
        hashtags=["welcome"],
    )
    stale_created_at = timezone.now() - timedelta(days=30)
    CoursePost.objects.filter(id=post.id).update(created_at=stale_created_at, updated_at=stale_created_at)

    CoursePostLike.objects.create(post=post, user=admin)
    CoursePostComment.objects.create(post=post, user=admin, content="Still engaging with this post")

    CourseDashboardSnapshot.objects.create(
        course=course,
        data={
            "course": {
                "id": course.id,
                "name": course.name,
                "term": course.term,
                "active": True,
                "course_code": course.course_code,
            },
            "summary": {
                "total_posts": 0,
                "total_interactions": 0,
                "registered_students": 1,
            },
            "hashtags": [],
            "students": [],
            "range_end": timezone.localdate().isoformat(),
            "sentiment": {
                "breakdown": {"neutral": 0.0, "negative": 0.0, "positive": 0.0},
                "top_label": "neutral",
                "top_percent": 0.0,
                "total_comments": 0,
            },
            "range_days": 7,
            "refreshing": False,
            "range_start": (timezone.localdate() - timedelta(days=7)).isoformat(),
        },
    )

    dashboard_service = _load_dashboard_service()
    body = dashboard_service.get_course_dashboard(user=admin, course_id=course.id)

    assert body["summary"]["registered_students"] == 1
    assert body["summary"]["total_posts"] == 1
    assert body["summary"]["total_interactions"] == 2
    assert body["students"][0]["user_id"] == student.id
    assert body["students"][0]["posts_total"] == 1
    assert body["hashtags"][0]["hashtag"] == "welcome"
    assert body["hashtags"][0]["total_posts"] == 1
