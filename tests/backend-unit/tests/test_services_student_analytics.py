from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.core.repositories import CourseMemberRepository, CourseRepository
from apps.core.repositories.models import CoursePost, CoursePostComment, CoursePostLike, CoursePostView
from apps.core.services.student_analytics_service import build_student_analytics_payload


def _create_user(*, prefix: str):
    User = get_user_model()
    suffix = uuid4().hex[:8]
    return User.objects.create_user(
        username=f"{prefix}_{suffix}",
        email=f"{prefix}_{suffix}@example.com",
        password="test-pass",
    )


@pytest.mark.django_db
def test_student_analytics_payload_returns_complete_backend_shape():
    teacher = _create_user(prefix="teacher")
    student = _create_user(prefix="student")

    today = timezone.localdate()
    course = CourseRepository.create(
        name="Student Analytics",
        course_code=f"SA{uuid4().hex[:4].upper()}",
        term="T1",
        join_code=uuid4().hex[:8].upper(),
        start_date=today - timedelta(days=14),
        end_date=today + timedelta(days=14),
        created_by=teacher,
    )
    CourseMemberRepository.get_or_create_member(course.id, teacher.id, role="teacher")
    CourseMemberRepository.get_or_create_member(course.id, student.id, role="student")

    older = timezone.now() - timedelta(days=3)
    recent = timezone.now() - timedelta(hours=2)

    first_post = CoursePost.objects.create(
        course=course,
        author=student,
        content="Quick AI example with #ai and #prompt tips?",
        hashtags=["ai", "prompt"],
    )
    second_post = CoursePost.objects.create(
        course=course,
        author=student,
        content="Career reflection on portfolio building #career",
        hashtags=["career"],
    )
    CoursePost.objects.filter(id=first_post.id).update(created_at=older, updated_at=older)
    CoursePost.objects.filter(id=second_post.id).update(created_at=recent, updated_at=recent)

    for _ in range(3):
        CoursePostLike.objects.create(post=first_post, user=_create_user(prefix="like_a"))
    for _ in range(2):
        CoursePostLike.objects.create(post=second_post, user=_create_user(prefix="like_b"))

    CoursePostComment.objects.create(post=first_post, user=teacher, content="Great prompt framing")
    CoursePostComment.objects.create(post=second_post, user=teacher, content="Useful career angle")

    for _ in range(4):
        CoursePostView.objects.create(post=first_post, user=None)
    for _ in range(6):
        CoursePostView.objects.create(post=second_post, user=None)

    payload = build_student_analytics_payload(user=student, target_user_id=student.id)

    assert payload["summary"]["totalPosts"] == 2
    assert payload["summary"]["totalLikes"] == 5
    assert payload["summary"]["totalComments"] == 2
    assert payload["summary"]["totalViews"] == 10
    assert payload["summary"]["totalInteractions"] == 7
    assert payload["summary"]["totalEngagement"] == 17
    assert len(payload["items"]) == 2
    assert len(payload["topPosts"]) >= 1
    assert payload["topPosts"][0]["id"] == second_post.id
    assert payload["topPosts"][0]["engagementScore"] == 9
    assert payload["topPosts"][0]["interactions"] == 3
    assert payload["engagementTrend"]["windowLabel"] == "Last 7 days vs previous 7 days"
    assert payload["engagementTrend"]["direction"] == "up"
    assert payload["engagementTrend"]["changePercent"] == 100
    assert payload["engagementTrend"]["currentWindowEngagement"] == 17
    assert payload["engagementTrend"]["previousWindowEngagement"] == 0
    assert payload["bestTimeToPost"]["bestHourLabel"] != "—"
    assert payload["bestTimeToPost"]["windowLabel"] == "Recent 7-day posting hours"
    assert payload["bestTimeToPost"]["sampleSize"] == 1
    assert payload["audienceInsights"]["strongestEngagedAudience"]
    assert isinstance(payload["audienceInsights"]["breakdown"], list)
    assert payload["aiInsight"]["title"] == "AI Insight"
    assert isinstance(payload["contentPatterns"], list)
    assert isinstance(payload["suggestions"], list)
    assert isinstance(payload["audiencePatterns"], list)


@pytest.mark.django_db
def test_student_analytics_payload_returns_safe_empty_shapes_without_posts():
    viewer = _create_user(prefix="viewer")
    student = _create_user(prefix="student")
    teacher = _create_user(prefix="teacher")

    today = timezone.localdate()
    course = CourseRepository.create(
        name="Empty Analytics",
        course_code=f"EA{uuid4().hex[:4].upper()}",
        term="T1",
        join_code=uuid4().hex[:8].upper(),
        start_date=today - timedelta(days=7),
        end_date=today + timedelta(days=7),
        created_by=teacher,
    )
    CourseMemberRepository.get_or_create_member(course.id, viewer.id, role="student")
    CourseMemberRepository.get_or_create_member(course.id, student.id, role="student")

    payload = build_student_analytics_payload(user=viewer, target_user_id=student.id)

    assert payload["items"] == []
    assert payload["summary"]["totalPosts"] == 0
    assert payload["summary"]["totalViews"] == 0
    assert payload["summary"]["totalEngagement"] == 0
    assert payload["topPosts"] == []
    assert payload["engagementTrend"]["series"] == []
    assert payload["bestTimeToPost"]["bestHourLabel"] == "—"
    assert payload["suggestions"]
