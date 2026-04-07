from apps.core.services.profile_service import (
    PROFILE_OPTIONS,
    normalize_ai_profile_payload,
)


def test_normalize_ai_profile_digital_time_from_activity_level():
    payload = {"activity_level": "Medium"}

    normalized = normalize_ai_profile_payload(payload)

    assert normalized["digital_time"] == "A few times a week"
    assert normalized["digital_time"] in PROFILE_OPTIONS["digital_time"]


def test_normalize_ai_profile_alias_fields_and_choices():
    payload = {
        "decision_factors": "Price",
        "buying_behaviour": "Price-sensitive",
        "preferred_content": "Pictures or videos",
        "interests": "tech & gaming; travel & food",
        "social_value": "9",
        "sociability": 11,  # will be clamped to 10
        "openness": 0,  # will be clamped to 1
    }

    normalized = normalize_ai_profile_payload(payload)

    assert normalized["decision_factor"] == "Price"
    assert normalized["buying_behavior"] == "Price-sensitive"
    assert normalized["content_preference"] == "Pictures or videos"

    # Interests should be normalized to canonical options, preserving order and uniqueness
    assert normalized["interests"] == [
        "Technology & Gaming",
        "Travel & Food",
    ]

    # Numeric traits normalized and clamped
    assert normalized["social_value"] == 9
    assert normalized["sociability"] == 10
    assert normalized["openness"] == 1

