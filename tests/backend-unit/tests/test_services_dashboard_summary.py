import importlib
import sys
from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.test import override_settings

from apps.core.repositories.models import (
    Course,
    CourseAIUser,
    CourseAIUserIdentity,
    CourseMember,
    CoursePost,
    CoursePostComment,
    CoursePostLike,
    CoursePostView,
)


def _create_user(username: str, *, is_staff: bool = False):
    User = get_user_model()
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="password123",
        is_staff=is_staff,
    )


def _create_course(created_by, *, suffix: str):
    return Course.objects.create(
        name=f"Dashboard Course {suffix}",
        course_code=f"COMP{suffix}",
        term="26T1",
        join_code=f"JOIN{suffix}",
        start_date="2026-01-01",
        end_date="2026-12-31",
        created_by=created_by,
    )


def _load_dashboard_service():
    sys.modules.pop("apps.core.services.dashboard_service", None)
    return importlib.import_module("apps.core.services.dashboard_service")


def test_refresh_dashboard_snapshot_excludes_ai_identity_users_from_registered_students(db):
    admin = _create_user("admin-summary", is_staff=True)
    real_student = _create_user("real-student")
    ai_identity_user = _create_user("ai-summary-user")

    course_a = _create_course(admin, suffix="9901")
    course_b = _create_course(admin, suffix="9902")

    CourseMember.objects.create(course=course_a, user=real_student, role="student")
    CourseMember.objects.create(course=course_b, user=real_student, role="student")
    CourseMember.objects.create(course=course_a, user=ai_identity_user, role="student")

    ai_user = CourseAIUser.objects.create(
        course=course_a,
        created_by=admin,
        username="ai-summary",
        display_name="AI Summary",
    )
    CourseAIUserIdentity.objects.create(ai_user=ai_user, user=ai_identity_user)

    dashboard_service = _load_dashboard_service()

    payload = dashboard_service.refresh_dashboard_snapshot(admin, range_days=7)

    assert payload["registered_students"] == 1
    assert len(payload["courses"]) == 2
    assert {course["registered_students"] for course in payload["courses"]} == {1}


def test_get_course_dashboard_excludes_ai_identity_users_from_registered_students(db):
    admin = _create_user("admin-course-summary", is_staff=True)
    real_student = _create_user("real-course-student")
    ai_identity_user = _create_user("ai-course-user")
    course = _create_course(admin, suffix="9903")

    CourseMember.objects.create(course=course, user=real_student, role="student")
    CourseMember.objects.create(course=course, user=ai_identity_user, role="student")

    ai_user = CourseAIUser.objects.create(
        course=course,
        created_by=admin,
        username="ai-course-summary",
        display_name="AI Course Summary",
    )
    CourseAIUserIdentity.objects.create(ai_user=ai_user, user=ai_identity_user)

    dashboard_service = _load_dashboard_service()

    payload = dashboard_service.get_course_dashboard(user=admin, course_id=course.id)

    assert payload["summary"]["registered_students"] == 1


def test_refresh_dashboard_snapshot_includes_views_in_engagement_totals(db):
    admin = _create_user("admin-summary-views", is_staff=True)
    student = _create_user("summary-views-student")
    course = _create_course(admin, suffix="9904")

    CourseMember.objects.create(course=course, user=student, role="student")

    post = CoursePost.objects.create(
        course=course,
        author=student,
        content="Testing dashboard engagement totals",
    )
    CoursePostLike.objects.create(post=post, user=admin)
    CoursePostComment.objects.create(post=post, user=admin, content="Useful post")
    CoursePostView.objects.create(post=post, user=admin)
    CoursePostView.objects.create(post=post, user=student)

    dashboard_service = _load_dashboard_service()

    payload = dashboard_service.refresh_dashboard_snapshot(admin, range_days=7)

    assert payload["total_likes"] == 1
    assert payload["total_comments"] == 1
    assert payload["total_views"] == 2
    assert payload["total_interactions"] == 4


def test_dashboard_summary_sentiment_matches_sentiment_detail_breakdown(db, monkeypatch):
    admin = _create_user("admin-summary-sentiment", is_staff=True)
    student = _create_user("summary-sentiment-student")
    course = _create_course(admin, suffix="9905")

    CourseMember.objects.create(course=course, user=student, role="student")

    post = CoursePost.objects.create(
        course=course,
        author=student,
        content="Testing sentiment consistency",
    )
    CoursePostComment.objects.create(post=post, user=admin, content="great work")
    CoursePostComment.objects.create(post=post, user=admin, content="needs fixes")
    CoursePostComment.objects.create(post=post, user=admin, content="noted")

    dashboard_service = _load_dashboard_service()

    def fake_classifier(text):
        normalized = str(text).lower()
        if "great" in normalized:
            return "positive"
        if "fix" in normalized:
            return "negative"
        return "neutral"

    monkeypatch.setattr(dashboard_service, "classify_comment_sentiment", fake_classifier)

    summary = dashboard_service.refresh_dashboard_snapshot(admin, range_days=7)
    detail = dashboard_service.get_admin_sentiment_distribution(user=admin, range_days=7)

    detail_breakdown = {item["key"]: item["percentage"] for item in detail["breakdown"]}

    assert summary["sentiment"] == detail_breakdown


@override_settings(ANALYTICS_TIME_ZONE="Australia/Sydney")
def test_refresh_dashboard_snapshot_uses_analytics_timezone_for_range_end(db, monkeypatch):
    admin = _create_user("admin-summary-timezone", is_staff=True)

    dashboard_service = _load_dashboard_service()

    monkeypatch.setattr(
        dashboard_service.timezone,
        "now",
        lambda: datetime(2026, 4, 23, 15, 30, tzinfo=dt_timezone.utc),
    )

    payload = dashboard_service.refresh_dashboard_snapshot(admin, range_days=7)

    assert payload["range_end"] == "2026-04-24"
    assert payload["range_start"] == "2026-04-17"
