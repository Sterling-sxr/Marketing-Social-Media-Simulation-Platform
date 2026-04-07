import json
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.core.repositories.models import Course, CourseAIUser


def _make_course(*, creator):
    return Course.objects.create(
        name="Social Media Lab",
        course_code="COMP9900",
        term="26T1",
        join_code="JOIN9901",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
        created_by=creator,
    )


@pytest.mark.django_db
def test_guided_preview_requires_authentication():
    user = get_user_model().objects.create_user(
        username="teacher5",
        email="teacher5@example.com",
        password="password123",
    )
    course = _make_course(creator=user)
    client = Client()

    response = client.post(
        f"/api/courses/{course.id}/ai-users/guided-preview/",
        data=json.dumps({"template_id": "mixed-interests", "count": 2}),
        content_type="application/json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_guided_preview_rejects_non_manager():
    teacher = get_user_model().objects.create_user(
        username="teacher6",
        email="teacher6@example.com",
        password="password123",
    )
    other_user = get_user_model().objects.create_user(
        username="student1",
        email="student1@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(other_user)

    response = client.post(
        f"/api/courses/{course.id}/ai-users/guided-preview/",
        data=json.dumps({"template_id": "mixed-interests", "count": 2}),
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_guided_preview_and_commit_happy_path():
    teacher = get_user_model().objects.create_user(
        username="teacher7",
        email="teacher7@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(teacher)

    preview_response = client.post(
        f"/api/courses/{course.id}/ai-users/guided-preview/",
        data=json.dumps(
            {
                "template_id": "mixed-interests",
                "count": 2,
                "audience_theme": "Demo Cohort",
            }
        ),
        content_type="application/json",
    )

    assert preview_response.status_code == 200
    preview_payload = preview_response.json()
    assert preview_payload["count"] == 2

    commit_response = client.post(
        f"/api/courses/{course.id}/ai-users/guided-commit/",
        data=json.dumps({"items": preview_payload["items"]}),
        content_type="application/json",
    )

    assert commit_response.status_code == 201
    commit_payload = commit_response.json()
    assert commit_payload["created"] == 2
    assert commit_payload["errors"] == []
    assert CourseAIUser.objects.filter(course=course).count() == 2


@pytest.mark.django_db
def test_generate_preview_returns_503_when_ai_client_unavailable(monkeypatch):
    teacher = get_user_model().objects.create_user(
        username="teacher8",
        email="teacher8@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(teacher)

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._get_client",
        lambda: None,
    )

    response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-preview/",
        data=json.dumps({"count": 2, "scenario_prompt": "demo cohort"}),
        content_type="application/json",
    )

    assert response.status_code == 503


@pytest.mark.django_db
def test_generate_preview_and_commit_happy_path(monkeypatch):
    teacher = get_user_model().objects.create_user(
        username="teacher9",
        email="teacher9@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(teacher)

    def fake_request(*, payload, course, existing_usernames):
        return [
            {
                "username": "gen-persona-1",
                "display_name": "Gen Persona 1",
                "age_group": "Gen Z (16-28)",
                "interests": ["Technology & Gaming", "Travel & Food"],
                "digital_time": "Several times a day",
                "content_preference": "Pictures or videos",
                "social_value": 6,
                "sociability": 7,
                "openness": 8,
            },
            {
                "username": "gen-persona-2",
                "display_name": "Gen Persona 2",
                "age_group": "Gen Y (29-44)",
                "interests": ["Arts & Culture"],
                "digital_time": "About once a day",
                "content_preference": "Thoughtful opinions",
                "social_value": 5,
                "sociability": 6,
                "openness": 7,
            },
        ]

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    preview_response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-preview/",
        data=json.dumps({"count": 2, "scenario_prompt": "demo cohort"}),
        content_type="application/json",
    )

    assert preview_response.status_code == 200
    preview_payload = preview_response.json()
    assert preview_payload["count"] == 2

    commit_response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-commit/",
        data=json.dumps({"items": preview_payload["items"]}),
        content_type="application/json",
    )

    assert commit_response.status_code == 201
    commit_payload = commit_response.json()
    assert commit_payload["created"] == 2
    assert CourseAIUser.objects.filter(course=course).count() == 2
