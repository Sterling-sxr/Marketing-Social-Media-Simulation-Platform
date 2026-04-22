from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model

from apps.core.repositories.models import Course, CourseAIUser
from apps.core.services.ai_persona_creation_service import (
    MAX_PERSONA_PREVIEW_COUNT,
    _build_generation_prompt,
    commit_guided_personas,
    preview_generated_personas,
    preview_guided_personas,
)
from apps.core.services.profile_service import PROFILE_OPTIONS


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

    assert result["count"] == 2
    assert result["items"][0]["username"] == "valid-one"
    assert any("bad-one" in warning for warning in result["warnings"])


@pytest.mark.django_db
def test_generate_preview_returns_blueprint_and_generation_meta(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher11",
        email="teacher11@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Distinct audience segments for a product launch demo with strong visual-response differences.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming", "Travel & Food"],
                "activity_profile": "high",
                "guardrails": ["Use only known profile values"],
            },
            "persona_seeds": [
                {
                    "seed_label": "curious trend follower",
                    "display_name": "Curious Trend Follower",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["commenter", "high activity"],
                    "score_hints": {"openness": "high", "sociability": "high", "social_value": "medium"},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Follows creator trends and reacts quickly to visuals.",
                }
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={
            "count": 1,
            "scenario_prompt": "Generate a launch-week demo cohort",
            "generation_mode": "ai_bulk",
            "constraints": {"age_group": ["Gen Z (16-28)"]},
        },
    )

    assert result["count"] == 1
    assert "segments" in result["cohort_blueprint"]["summary"].lower()
    assert result["generation_meta"]["model_strategy"] == "seed_then_rule_expansion"
    assert result["generation_meta"]["repaired_count"] == 0
    assert result["generation_meta"]["rejected_count"] == 0
    assert result["items"][0]["content_preference"] in PROFILE_OPTIONS["content_preference"]
    assert result["items"][0]["decision_factor"] in PROFILE_OPTIONS["decision_factors"]
    assert "curious trend follower" in result["items"][0]["notes"].lower()


@pytest.mark.django_db
def test_generate_prompt_includes_contract_examples_and_field_level_constraints():
    user = get_user_model().objects.create_user(
        username="teacher18",
        email="teacher18@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    prompt = _build_generation_prompt(
        payload={
            "count": 2,
            "scenario_prompt": "Launch-week audience segments",
            "generation_mode": "ai_bulk",
            "constraints": {"age_group": ["Gen Z (16-28)"]},
        },
        course=course,
    )

    assert "Top-level JSON contract" in prompt
    assert '"cohort_blueprint"' in prompt
    assert '"persona_seeds"' in prompt
    assert '"score_hints": {"social_value": 6, "sociability": 7, "openness": 8}' in prompt
    assert 'Do NOT return: "score_hints": "high"' in prompt
    assert 'Do NOT return: "behavior_signals": "commenter"' in prompt
    assert 'Do NOT return: "interest_biases": "Technology & Gaming"' in prompt
    assert "Allowed values by field:" in prompt
    assert "interest_biases:" in prompt
    assert "behavior_signals:" in prompt
    assert "content_bias:" in prompt
    assert "shopping_bias:" in prompt
    assert "age_group:" in prompt


@pytest.mark.django_db
def test_generate_preview_repairs_invalid_seed_values_and_tracks_meta(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher12",
        email="teacher12@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "A mixed set of audience segments for comparison.",
                "age_mix": ["Gen Z (16-28)", "Gen Y (29-44)"],
                "interest_clusters": ["Technology & Gaming", "Arts & Culture"],
                "activity_profile": "mixed",
                "guardrails": ["Keep to existing schema"],
            },
            "persona_seeds": [
                {
                    "username": "repair-me",
                    "seed_label": "repair me",
                    "interest_biases": ["Totally Invalid Interest", "Technology & Gaming"],
                    "behavior_signals": ["scroll-heavy"],
                    "score_hints": {"openness": "very high", "sociability": 42, "social_value": "low"},
                    "content_bias": "Not a real content bias",
                    "shopping_bias": "Not a decision factor",
                    "context_note": "Needs repair.",
                },
                {
                    "username": "reject-me",
                    "seed_label": "reject me",
                    "interest_biases": [],
                    "behavior_signals": [],
                    "score_hints": {},
                    "content_bias": "",
                    "shopping_bias": "",
                    "context_note": "",
                },
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 2, "scenario_prompt": "Generate a review cohort", "generation_mode": "ai_bulk"},
    )

    assert result["count"] == 1
    assert result["generation_meta"]["repaired_count"] >= 1
    assert result["generation_meta"]["rejected_count"] == 1
    assert result["items"][0]["content_preference"] in PROFILE_OPTIONS["content_preference"]
    assert result["items"][0]["decision_factor"] in PROFILE_OPTIONS["decision_factors"]
    assert all(1 <= result["items"][0][field] <= 10 for field in ("social_value", "sociability", "openness"))
    assert any("reject-me" in warning for warning in result["warnings"])


@pytest.mark.django_db
def test_generate_preview_tolerates_non_object_seed_fields_and_warns(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher14",
        email="teacher14@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Segments with inconsistent AI formatting.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming", "Travel & Food"],
                "activity_profile": "mixed",
                "guardrails": ["Keep using known schema values."],
            },
            "persona_seeds": [
                {
                    "username": "format-weird",
                    "display_name": "Format Weird",
                    "interest_biases": "Technology & Gaming",
                    "behavior_signals": "commenter",
                    "score_hints": "very engaged",
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Still usable despite malformed fields.",
                }
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 1, "scenario_prompt": "Generate resilient preview output"},
    )

    assert result["count"] == 2
    assert result["items"][0]["username"] == "format-weird"
    assert result["items"][0]["social_value"] == 5
    assert result["items"][0]["sociability"] == 5
    assert result["items"][0]["openness"] == 5
    assert any("score hints" in warning.lower() for warning in result["warnings"])
    assert any("interest_biases" in warning.lower() for warning in result["warnings"])
    assert any("behavior_signals" in warning.lower() for warning in result["warnings"])


@pytest.mark.django_db
def test_generate_preview_keeps_personas_when_only_second_interest_differs(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher19",
        email="teacher19@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Keep nuanced variants.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming", "Travel & Food", "Arts & Culture"],
                "activity_profile": "About once a day",
                "guardrails": ["Keep distinct audience variants."],
            },
            "persona_seeds": [
                {
                    "username": "variant-one",
                    "display_name": "Variant One",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Visual-first traveler.",
                },
                {
                    "username": "variant-two",
                    "display_name": "Variant Two",
                    "interest_biases": ["Technology & Gaming", "Arts & Culture"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Visual-first culture seeker.",
                },
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 2, "scenario_prompt": "Generate nuanced variants", "generation_mode": "ai_bulk"},
    )

    assert result["count"] == 2
    assert result["generation_meta"]["rejected_count"] == 0
    assert {item["username"] for item in result["items"]} == {"variant-one", "variant-two"}


@pytest.mark.django_db
def test_generate_preview_keeps_personas_when_decision_factor_differs(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher20",
        email="teacher20@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Keep decision-driver variants.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming", "Travel & Food"],
                "activity_profile": "About once a day",
                "guardrails": ["Keep distinct audience variants."],
            },
            "persona_seeds": [
                {
                    "username": "price-first",
                    "display_name": "Price First",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Price",
                    "context_note": "Compares offers closely.",
                },
                {
                    "username": "quality-first",
                    "display_name": "Quality First",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Quality/durability",
                    "context_note": "Looks for lasting value.",
                },
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 2, "scenario_prompt": "Generate decision-driver variants", "generation_mode": "ai_bulk"},
    )

    assert result["count"] == 2
    assert result["generation_meta"]["rejected_count"] == 0
    assert {item["decision_factor"] for item in result["items"]} == {"Price", "Quality/durability"}


@pytest.mark.django_db
def test_generate_preview_rejects_only_after_duplicate_repair_attempts_fail(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher21",
        email="teacher21@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Fully duplicated variants.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming", "Travel & Food"],
                "activity_profile": "About once a day",
                "guardrails": ["Keep distinct audience variants."],
            },
            "persona_seeds": [
                {
                    "username": "full-dup-one",
                    "display_name": "Full Dup One",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "First one.",
                },
                {
                    "username": "full-dup-two",
                    "display_name": "Full Dup Two",
                    "interest_biases": ["Technology & Gaming", "Travel & Food"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 6, "sociability": 7, "openness": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Second one.",
                },
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 2, "scenario_prompt": "Generate duplicate variants", "generation_mode": "ai_bulk"},
    )

    assert result["count"] == 2
    assert result["generation_meta"]["rejected_count"] == 1
    assert any("after repair attempts" in warning for warning in result["warnings"])


@pytest.mark.django_db
def test_generate_preview_skips_seed_with_invalid_score_hints_when_other_details_missing(monkeypatch):
    user = get_user_model().objects.create_user(
        username="teacher15",
        email="teacher15@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    def fake_request(*, payload, course, existing_usernames):
        return {
            "cohort_blueprint": {
                "summary": "Mostly empty malformed segments.",
                "age_mix": ["Gen Z (16-28)"],
                "interest_clusters": ["Technology & Gaming"],
                "activity_profile": "mixed",
                "guardrails": ["Keep using known schema values."],
            },
            "persona_seeds": [
                {
                    "username": "skip-me",
                    "display_name": "Skip Me",
                    "interest_biases": [],
                    "behavior_signals": [],
                    "score_hints": "bad-shape",
                    "content_bias": "",
                    "shopping_bias": "",
                    "context_note": "",
                },
                {
                    "username": "keep-me",
                    "display_name": "Keep Me",
                    "interest_biases": ["Technology & Gaming"],
                    "behavior_signals": ["commenter"],
                    "score_hints": {"social_value": 7},
                    "content_bias": "Pictures or videos",
                    "shopping_bias": "Convenience",
                    "context_note": "Enough detail to survive.",
                },
            ],
        }

    monkeypatch.setattr(
        "apps.core.services.ai_persona_creation_service._request_generated_drafts",
        fake_request,
    )

    result = preview_generated_personas(
        user=user,
        course_id=course.id,
        payload={"count": 2, "scenario_prompt": "Generate resilient preview output"},
    )

    assert result["count"] == 2
    assert result["items"][0]["username"] == "keep-me"
    assert result["generation_meta"]["rejected_count"] == 1
    assert any("skip-me" in warning for warning in result["warnings"])


@pytest.mark.django_db
def test_guided_preview_supports_smart_generate_goal_payload():
    user = get_user_model().objects.create_user(
        username="teacher10",
        email="teacher10@example.com",
        password="password123",
    )
    course = _make_course(creator=user)

    result = preview_guided_personas(
        user=user,
        course_id=course.id,
        payload={
            "goal": "broad_audience",
            "count": 3,
            "coverage": "wide",
            "activity_level": "high",
            "interest_lean": "tech",
        },
    )

    assert result["count"] == 3
    assert result["smart_profile"]["goal"] == "broad_audience"
    assert result["smart_profile"]["goal_label"] == "Explore Broad Audience"
    assert any("Explore Broad Audience" in warning for warning in result["warnings"])
