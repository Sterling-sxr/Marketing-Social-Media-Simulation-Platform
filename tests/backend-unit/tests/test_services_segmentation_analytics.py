from django.contrib.auth import get_user_model
from django.test import Client

from apps.core.repositories.models import (
    Course,
    CourseAIUser,
    CourseAIUserIdentity,
    CourseMember,
    CoursePost,
    CoursePostComment,
    CoursePostLike,
    CoursePostView,
    CourseProfile,
)
from apps.core.services.segmentation_analytics_service import (
    get_admin_course_segmentation,
    get_admin_post_segmentation,
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
        name="Audience Analytics",
        course_code="MKTG9900",
        term="26T1",
        join_code="SEGMENT1",
        start_date="2026-01-01",
        end_date="2026-12-31",
        created_by=created_by,
    )


def _join_student(course, user):
    return CourseMember.objects.create(course=course, user=user, role="student")


def _create_profile(course, user, **overrides):
    base = {
        "age_group": "Gen Z (16-28)",
        "interests": ["Technology & Gaming"],
        "content_preference": "Pictures or videos",
        "digital_time": "Several times a day",
        "interaction_style": "Comment on posts",
    }
    base.update(overrides)
    return CourseProfile.objects.create(course=course, user=user, **base)


def test_course_segmentation_aggregates_interest_buckets_and_marks_partial_data(db):
    admin = _create_user("admin-seg", is_staff=True)
    course = _create_course(admin)
    student_a = _create_user("student-a")
    student_b = _create_user("student-b")
    student_c = _create_user("student-c")

    for student in (student_a, student_b, student_c):
        _join_student(course, student)

    _create_profile(
        course,
        student_a,
        interests=["Technology & Gaming", "Travel & Food"],
        age_group="Gen Z (16-28)",
    )
    _create_profile(
        course,
        student_b,
        interests=["Travel & Food"],
        age_group="Gen Y (29-44)",
        content_preference="Thoughtful opinions",
        digital_time="About once a day",
        interaction_style="Mostly just scroll/watch",
    )

    post_a = CoursePost.objects.create(course=course, author=admin, content="Post A about gaming trips")
    post_b = CoursePost.objects.create(course=course, author=admin, content="Post B about thoughtful reviews")

    CoursePostView.objects.create(post=post_a, user=student_a)
    CoursePostView.objects.create(post=post_a, user=student_b)
    CoursePostView.objects.create(post=post_a, user=None)
    CoursePostLike.objects.create(post=post_a, user=student_a)
    CoursePostComment.objects.create(post=post_a, user=student_a, content="Loved this one")

    CoursePostView.objects.create(post=post_b, user=student_b)
    CoursePostLike.objects.create(post=post_b, user=student_b)
    CoursePostComment.objects.create(post=post_b, user=student_b, content="More of this please")

    course_payload = get_admin_course_segmentation(user=admin, course_id=course.id, lens="interests")

    assert course_payload["selected_lens"] == "interests"
    assert course_payload["lens_meta"]["overlapping"] is True
    assert course_payload["coverage"]["total_audience"] == 3
    assert course_payload["coverage"]["missing_profile_count"] == 1
    assert course_payload["coverage"]["missing_actor_identity_count"] == 1
    assert course_payload["coverage"]["partial_data"] is True

    segments = {item["label"]: item for item in course_payload["segments"]}
    assert segments["Travel & Food"]["audience_count"] == 2
    assert segments["Travel & Food"]["engaged_user_count"] == 2
    assert segments["Travel & Food"]["metrics"]["views"] == 3
    assert segments["Technology & Gaming"]["audience_count"] == 1
    assert segments["Technology & Gaming"]["metrics"]["likes"] == 1
    assert segments["Unknown"]["audience_count"] == 1

    assert len(course_payload["posts"]) == 2
    assert course_payload["insights"]["top_segment"]["label"] in segments
    assert course_payload["insights"]["summary_text"]


def test_post_segmentation_compare_and_admin_only_api_access(db):
    admin = _create_user("admin-api", is_staff=True)
    non_admin = _create_user("student-api")
    course = _create_course(admin)
    profiled = _create_user("profiled-user")
    other = _create_user("other-user")

    for student in (profiled, other, non_admin):
        _join_student(course, student)

    _create_profile(course, profiled, age_group="Gen Z (16-28)")
    _create_profile(
        course,
        other,
        age_group="Gen Y (29-44)",
        interests=["Travel & Food"],
        content_preference="Thoughtful opinions",
        digital_time="About once a day",
        interaction_style="Mostly just scroll/watch",
    )

    post_a = CoursePost.objects.create(course=course, author=admin, content="Launch video clips")
    post_b = CoursePost.objects.create(course=course, author=admin, content="Long-form discussion")

    CoursePostView.objects.create(post=post_a, user=profiled)
    CoursePostLike.objects.create(post=post_a, user=profiled)
    CoursePostComment.objects.create(post=post_a, user=profiled, content="Great for Gen Z")

    CoursePostView.objects.create(post=post_b, user=other)
    CoursePostLike.objects.create(post=post_b, user=other)

    payload = get_admin_post_segmentation(
        user=admin,
        course_id=course.id,
        post_id=post_a.id,
        lens="age_group",
        compare_post_id=post_b.id,
    )

    assert payload["selected_lens"] == "age_group"
    assert payload["comparison"]["compare_post"]["post_id"] == post_b.id
    comparison_segments = {item["label"]: item for item in payload["comparison"]["segments"]}
    assert comparison_segments["Gen Z (16-28)"]["post_metrics"]["engagement_rate"] == 2.0
    assert comparison_segments["Gen Z (16-28)"]["compare_metrics"]["engagement_rate"] == 0.0
    assert payload["insights"]["comparison_summary_text"]

    client = Client()
    client.force_login(non_admin)
    denied = client.get(f"/api/admin/dashboard/courses/{course.id}/segmentation?lens=age_group")
    assert denied.status_code == 403

    client.force_login(admin)
    allowed = client.get(
        f"/api/admin/courses/{course.id}/posts/{post_a.id}/segmentation?lens=age_group&compare_post_id={post_b.id}"
    )
    assert allowed.status_code == 200
    body = allowed.json()
    assert body["segmentation"]["selected_lens"] == "age_group"
    assert body["segmentation"]["comparison"]["compare_post"]["post_id"] == post_b.id


def test_course_segmentation_uses_ai_persona_attributes_for_identity_users(db):
    admin = _create_user("admin-ai", is_staff=True)
    course = _create_course(admin)
    ai_identity_user = _create_user("ai-identity-user")
    _join_student(course, ai_identity_user)

    ai_user = CourseAIUser.objects.create(
        course=course,
        created_by=admin,
        username="ai_bucket",
        display_name="AI Bucket",
        age_group="Gen X (45-60)",
        content_preference="Detailed reviews or long posts",
        digital_time="Almost constantly",
        interaction_style="Share posts with friends",
        interests=["Technology & Gaming"],
    )
    CourseAIUserIdentity.objects.create(ai_user=ai_user, user=ai_identity_user)

    post = CoursePost.objects.create(course=course, author=admin, content="AI persona test post")
    CoursePostView.objects.create(post=post, user=ai_identity_user)
    CoursePostLike.objects.create(post=post, user=ai_identity_user)

    payload = get_admin_course_segmentation(user=admin, course_id=course.id, lens="age_group")

    segments = {item["label"]: item for item in payload["segments"]}
    assert segments["Gen X (45-60)"]["audience_count"] == 1
    assert "Unknown" not in segments
    assert payload["coverage"]["missing_profile_count"] == 0
