from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model

from apps.core.repositories.models import Course, CourseAIUser
from apps.core.services.ai_persona_creation_service import (
    MAX_PERSONA_PREVIEW_COUNT,
    commit_guided_personas,
    preview_generated_personas,
    preview_guided_personas,
)


def _make_course(*, creator):
    return Course.objects.create(
        name="Social Media Lab",
        course_code="COMP9900",
        term="26T1",
        join_code="JOIN9900",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
        created_by=creator,
    )


@pytest.mark.django_db
def test_guided_preview_returns_normalized_drafts_with_unique_usernames():
    user = get_user_model().objects.create_user(
        username="teacher1",
        email="teacher1@example.com",
        password="password123",
    )
    course = _make_course(creator=user)
    CourseAIUser.objects.create(course=course, created_by=user, username="marketing-audience-1")

    result = preview_guided_personas(
        user=user,
        course_id=course.id,
        payload={
            "template_id": "marketing-audience",
            "count": 3,
            "audience_theme": "Marketing Audience",
            "interest_mix": ["Technology & Gaming", "Travel & Food"],
            "digital_time": "Several times a day",
            "content_preference": "Pictures or videos",
        },
    )

    assert result["count"] == 3
    assert result["limits"]["mode"] == "guided"
    usernames = [item["username"] for item in result["items"]]
    assert len(set(usernames)) == 3
    assert "marketing-audience-1" not in usernames
    assert all(item["digital_time"] == "Several times a day" for item in result["items"])
    assert all(item["content_preference"] == "Pictures or videos" for item in result["items"])
    assert all(item["warnings"] == [] for item in result["items"])


@pytest.mark.django_db
def test_guided_commit_persists_reviewed_drafts():
    user = get_user_model().objects.create_user(
        username="teacher2",
        email="teacher2@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    preview = preview_guided_personas(
        user=user,
        course_id=course.id,
        payload={
            "template_id": "undergraduate-heavy",
            "count": 2,
            "audience_theme": "Undergraduate Cohort",
        },
    )

    committed = commit_guided_personas(
        user=user,
        course_id=course.id,
        payload={"items": preview["items"]},
    )

    assert committed["created"] == 2
    assert committed["errors"] == []
    assert CourseAIUser.objects.filter(course=course).count() == 2


@pytest.mark.django_db
def test_generate_preview_rejects_count_above_limit():
    user = get_user_model().objects.create_user(
        username="teacher3",
        email="teacher3@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    with pytest.raises(ValueError, match="count must be between 1 and"):
        preview_generated_personas(
            user=user,
            course_id=course.id,
            payload={"count": MAX_PERSONA_PREVIEW_COUNT + 1, "scenario_prompt": "demo"},
        )


@pytest.mark.django_db
def test_generate_preview_skips_invalid_ai_drafts_and_surfaces_warnings(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher4",
        email="teacher4@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return [
            {
                "username": "valid-one",
                "display_name": "Valid One",
                "age_group": "Gen Z (16-28)",
                "interests": ["Technology & Gaming"],
                "digital_time": "Several times a day",
                "content_preference": "Pictures or videos",
                "social_value": 7,
                "sociability": 8,
                "openness": 6,
            },
            {
                "username": "bad-one",
                "display_name": "Bad One",
                "age_group": "Invalid Age Bucket",
                "interests": ["Technology & Gaming"],
            },
        ]

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 2, "scenario_prompt": "Generate a demo cohort"},
    )

    assert result["count"] == 1
    assert result["items"][0]["username"] == "valid-one"
    assert any("bad-one" in warning for warning in result["warnings"])
