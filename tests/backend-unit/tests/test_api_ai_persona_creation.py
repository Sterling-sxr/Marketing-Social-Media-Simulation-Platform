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
        data=json.dumps({"count": 2, "scenario_prompt": "demo audience segments"}),
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
        return {
            "cohort_blueprint": {
                "summary": "Distinct audience segments for campaign rehearsal.",
                "age_mix": ["Gen Z (16-28)", "Gen Y (29-44)"],
                "interest_clusters": ["Technology & Gaming", "Arts & Culture"],
                "activity_profile": "mixed",
                "guardrails": ["Use existing schema values"],
            },
            "persona_seeds": [
                {
                    "username": "gen-persona-1",
                    "seed_label": "launch enthusiast",
                    "display_name": "Gen Persona 1",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["high activity", "commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 8},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Fast adopter.",
                },
                {
                    "username": "gen-persona-2",
                    "seed_label": "thoughtful comparer",
                    "display_name": "Gen Persona 2",
                    "interest_biases": ["Arts & Culture"],
                    "behavior_signals": ["moderate activity", "observer"],
                    "score_hints": {"social_value": 5, "sociability": 6, "openness": 7},
                    "content_bias": "Thoughtful opinions",
                    "shopping_bias": "Quality/durability",
                    "context_note": "Reads before reacting.",
                },
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    preview_response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-preview/",
        data=json.dumps({"count": 2, "scenario_prompt": "demo audience segments"}),
        content_type="application/json",
    )

    assert preview_response.status_code == 200
    preview_payload = preview_response.json()
    assert preview_payload["count"] == 2
    assert preview_payload["cohort_blueprint"]["summary"] == "Distinct audience segments for campaign rehearsal."
    assert preview_payload["generation_meta"]["model_strategy"] == "single_call_blueprint_seed"

    commit_response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-commit/",
        data=json.dumps({"items": preview_payload["items"]}),
        content_type="application/json",
    )

    assert commit_response.status_code == 201
    commit_payload = commit_response.json()
    assert commit_payload["created"] == 2
    assert CourseAIUser.objects.filter(course=course).count() == 2


@pytest.mark.django_db
def test_generate_preview_rejects_invalid_constraints_payload(monkeypatch):
    teacher = get_user_model().objects.create_user(
        username="teacher13",
        email="teacher13@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(teacher)

    response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-preview/",
        data=json.dumps(
            {
                "count": 2,
                "generation_mode": "ai_bulk",
                "constraints": {"digital_time": ["Definitely always online"]},
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "constraints" in response.json()["error"]


@pytest.mark.django_db
def test_generate_preview_api_tolerates_non_object_score_hints(monkeypatch):
    teacher = get_user_model().objects.create_user(
        username="teacher16",
        email="teacher16@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(teacher)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Distinct audience segments for malformed-score-hints coverage.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming", "Travel & Food"],
                "activity_profile": "mixed",
                "guardrails": ["Use existing schema values"],
            },
            "persona_seeds": [
                {
                    "username": "api-weird-one",
                    "seed_label": "api weird one",
                    "display_name": "API Weird One",
                    "interest_biases": "Technology & Gaming",
                    "behavior_signals": "commenter",
                    "score_hints": "high",
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Should still render a preview.",
                }
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-preview/",
        data=json.dumps({"count": 1, "scenario_prompt": "malformed score hints"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert any("score hints" in warning.lower() for warning in payload["warnings"])


@pytest.mark.django_db
def test_generate_preview_api_returns_503_when_all_generated_seeds_are_invalid(monkeypatch):
    teacher = get_user_model().objects.create_user(
        username="teacher17",
        email="teacher17@example.com",
        password="password123",
    )
    course = _make_course(creator=teacher)
    client = Client()
    client.force_login(teacher)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "All malformed segments.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming"],
                "activity_profile": "mixed",
                "guardrails": ["Use existing schema values"],
            },
            "persona_seeds": [
                {
                    "username": "all-bad",
                    "display_name": "All Bad",
                    "interest_biases": [],
                    "behavior_signals": [],
                    "score_hints": "invalid-shape",
                    "content_bias": "",
                    "shopping_bias": "",
                    "context_note": "",
                }
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    response = client.post(
        f"/api/courses/{course.id}/ai-users/generate-preview/",
        data=json.dumps({"count": 1, "scenario_prompt": "all invalid seeds"}),
        content_type="application/json",
    )

    assert response.status_code == 503
    assert "did not produce any valid preview personas" in response.json()["error"]
