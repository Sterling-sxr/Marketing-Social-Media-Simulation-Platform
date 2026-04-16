"""Module summary: Collect related domain logic and document the intended design boundaries."""

from __future__ import annotations

from typing import Any

from django.db import transaction

from ..repositories import FollowRepository, ProfileRepository, UserProfile

PROFILE_OPTIONS = {
    "genders": ["Male", "Female", "Prefer not to say"],
    "cities": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
    "age_groups": ["Gen Z (16-28)", "Gen Y (29-44)", "Gen X (45-60)", "Baby Boomer (61-79)"],
    "education_levels": [
        "High School",
        "Vocational / TAFE",
        "University Education",
        "Post-graduate Education",
    ],
    "income_levels": [
        "Under $30K /year",
        "$30K - $49,999 /year",
        "$50K - $89,999 /year",
        "$90K - $149,999 /year",
        "Over $150K /year",
    ],
    "interests": [
        "Fitness & Sports",
        "Arts & Culture",
        "Technology & Gaming",
        "Travel & Food",
        "Fashion & Shopping",
        "Outdoor & Nature",
        "Family & Home Life",
        "Politics & Social Issues",
    ],
    "shopping_frequency": ["Rarely", "Sometimes", "Often", "Very often"],
    "buying_behavior": ["Brand loyal", "Switcher", "Price-sensitive"],
    "decision_factors": ["Price", "Quality/durability", "Brand image", "Eco-friendly", "Convenience"],
    "shopping_preference": ["Online only", "In stores only", "Both online and in stores"],
    "digital_time": [
        "Almost constantly",
        "Several times a day",
        "About once a day",
        "A few times a week",
        "About once a week or less",
    ],
    "content_preference": [
        "Funny short posts/memes",
        "Pictures or videos",
        "Thoughtful opinions",
        "Detailed reviews or long posts",
    ],
    "interaction_style": [
        "Like/react to posts",
        "Comment on posts",
        "Share posts with friends",
        "Mostly just scroll/watch",
    ],
    "influencer_type": [
        "Fashion & Beauty",
        "Fitness & Wellness",
        "Tech & Gaming",
        "Travel & Food",
        "Entertainment",
        "Business & Finance",
        "Eco & Ethical Lifestyle",
    ],
}

PROFILE_STRING_FIELDS = [
    "avatar_url",
    "gender",
    "city",
    "age_group",
    "education_level",
    "income_level",
    "shopping_frequency",
    "buying_behavior",
    "decision_factor",
    "shopping_preference",
    "digital_time",
    "content_preference",
    "interaction_style",
    "influencer_type",
]
PROFILE_NUMERIC_FIELDS = [
    ("social_value", 5),
    ("sociability", 5),
    ("openness", 5),
]

# Context: Compute shared values once so all branches use the same normalized inputs.
AI_FIELD_ALIASES: dict[str, str] = {
    # Context: Compute shared values once so all branches use the same normalized inputs.
    "decision_factors": "decision_factor",
    "buying_behaviour": "buying_behavior",
    # Context: Compute shared values once so all branches use the same normalized inputs.
    "activity_level": "digital_time",
    "preferred_content": "content_preference",
}

# Context: Compute shared values once so all branches use the same normalized inputs.
PROFILE_OPTIONS_KEY_BY_FIELD: dict[str, str] = {
    "gender": "genders",
    "city": "cities",
    "age_group": "age_groups",
    "education_level": "education_levels",
    "income_level": "income_levels",
    "shopping_frequency": "shopping_frequency",
    "buying_behavior": "buying_behavior",
    "decision_factor": "decision_factors",
    "shopping_preference": "shopping_preference",
    "digital_time": "digital_time",
    "content_preference": "content_preference",
    "interaction_style": "interaction_style",
    "influencer_type": "influencer_type",
}

# Context: Compute shared values once so all branches use the same normalized inputs.
INTEREST_ALIASES: dict[str, str] = {
    "tech & gaming": "Technology & Gaming",
    "technology and gaming": "Technology & Gaming",
    "travel & food": "Travel & Food",
    "travel and food": "Travel & Food",
    "fitness & sports": "Fitness & Sports",
    "arts & culture": "Arts & Culture",
    "fashion & shopping": "Fashion & Shopping",
    "outdoor & nature": "Outdoor & Nature",
    "family & home life": "Family & Home Life",
    "politics & social issues": "Politics & Social Issues",
}


def _normalize_choice(value: Any, options_key: str) -> str:
    """Execute the `_normalize_choice` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not value:
        return ""
    options = PROFILE_OPTIONS.get(options_key) or []
    if not options:
        return (value or "").strip() if isinstance(value, str) else str(value)

    text = (value or "").strip()
    lowered = text.lower()

    # Context: Compute shared values once so all branches use the same normalized inputs.
    for opt in options:
        if opt.lower() == lowered:
            return opt

    # Context: Compute shared values once so all branches use the same normalized inputs.
    for opt in options:
        if lowered in opt.lower():
            return opt

    # Context: Compute shared values once so all branches use the same normalized inputs.
    return text


def _normalize_digital_time(value: Any) -> str:
    """Execute the `_normalize_digital_time` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not value:
        return ""
    text = (value or "").strip()
    lowered = text.lower()

    # Context: Compute shared values once so all branches use the same normalized inputs.
    if lowered == "high":
        text = "Several times a day"
    elif lowered == "medium":
        text = "A few times a week"
    elif lowered == "low":
        text = "About once a week or less"

    return _normalize_choice(text, "digital_time")


def _normalize_interests(value: Any) -> list[str]:
    """Execute the `_normalize_interests` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    options = PROFILE_OPTIONS.get("interests") or []
    if not value:
        return []

    raw_items: list[str]
    if isinstance(value, str):
        # Context: Compute shared values once so all branches use the same normalized inputs.
        normalized_text = value.replace("\n", ",").replace(";", ",")
        raw_items = [part.strip() for part in normalized_text.split(",") if part.strip()]
    elif isinstance(value, (list, tuple, set)):
        raw_items = [str(item).strip() for item in value if str(item).strip()]
    else:
        return []

    normalized: list[str] = []
    for item in raw_items:
        lowered = item.lower()

        # Context: Compute shared values once so all branches use the same normalized inputs.
        alias_match = INTEREST_ALIASES.get(lowered)
        if alias_match and alias_match in options and alias_match not in normalized:
            normalized.append(alias_match)
            continue

        # Context: Compute shared values once so all branches use the same normalized inputs.
        match = None
        for opt in options:
            if opt.lower() == lowered:
                match = opt
                break
        if not match:
            # Context: Compute shared values once so all branches use the same normalized inputs.
            for opt in options:
                if lowered in opt.lower():
                    match = opt
                    break
        if match and match not in normalized:
            normalized.append(match)

    return normalized


def _normalize_numeric(value: Any, default: int = 5) -> int:
    """Execute the `_normalize_numeric` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    try:
        num = int(value)
    except (TypeError, ValueError):
        return default
    if num < 1:
        return 1
    if num > 10:
        return 10
    return num


def normalize_ai_profile_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Execute the `normalize_ai_profile_payload` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    if not isinstance(payload, dict):
        return {}

    normalized: dict[str, Any] = {}

    for raw_key, raw_value in payload.items():
        key = AI_FIELD_ALIASES.get(raw_key, raw_key)

        # Context: Compute shared values once so all branches use the same normalized inputs.
        if key in {"social_value", "sociability", "openness"}:
            normalized[key] = _normalize_numeric(raw_value)
            continue

        # Context: Compute shared values once so all branches use the same normalized inputs.
        if key == "interests":
            normalized["interests"] = _normalize_interests(raw_value)
            continue

        # Context: Compute shared values once so all branches use the same normalized inputs.
        if key == "digital_time":
            normalized["digital_time"] = _normalize_digital_time(raw_value)
            continue

        # Context: Compute shared values once so all branches use the same normalized inputs.
        if key in PROFILE_STRING_FIELDS:
            options_key = PROFILE_OPTIONS_KEY_BY_FIELD.get(key)
            if options_key:
                normalized[key] = _normalize_choice(raw_value, options_key)
            else:
                # Context: Compute shared values once so all branches use the same normalized inputs.
                if isinstance(raw_value, str):
                    normalized[key] = raw_value.strip()
                else:
                    normalized[key] = raw_value
            continue

        # Context: Compute shared values once so all branches use the same normalized inputs.

    return normalized


def needs_profile(user) -> bool:
    """Execute the `needs_profile` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return False


def merge_profile_payload(payload: dict[str, Any], base=None) -> dict[str, Any]:
    """Execute the `merge_profile_payload` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    profile_data: dict[str, Any] = {}

    for field in PROFILE_STRING_FIELDS:
        if field in payload:
            value = payload.get(field)
            profile_data[field] = (value or "").strip() if isinstance(value, str) else (value or "")
        elif base is not None:
            profile_data[field] = getattr(base, field, "")
        else:
            profile_data[field] = ""

    if "interests" in payload:
        value = payload.get("interests") or []
        profile_data["interests"] = list(value)
    elif base is not None:
        profile_data["interests"] = list(getattr(base, "interests", []) or [])
    else:
        profile_data["interests"] = []

    for field, default in PROFILE_NUMERIC_FIELDS:
        if field in payload:
            try:
                profile_data[field] = int(payload.get(field, default))
            except (TypeError, ValueError):
                profile_data[field] = default
        elif base is not None:
            profile_data[field] = getattr(base, field, default)
        else:
            profile_data[field] = default

    return profile_data


@transaction.atomic
def save_profile(user, payload: dict[str, Any]) -> UserProfile:
    """Execute the `save_profile` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    existing = ProfileRepository.get_by_user_id(user.id)
    profile_data = merge_profile_payload(payload, base=existing)
    profile, _created = ProfileRepository.create_or_update(user.id, profile_data)
    return profile


def profile_to_dict(profile: UserProfile) -> dict[str, Any]:
    return {
        "avatar_url": profile.avatar_url,
        "gender": profile.gender,
        "city": profile.city,
        "age_group": profile.age_group,
        "education_level": profile.education_level,
        "income_level": profile.income_level,
        "social_value": profile.social_value,
        "interests": profile.interests,
        "sociability": profile.sociability,
        "openness": profile.openness,
        "shopping_frequency": profile.shopping_frequency,
        "buying_behavior": profile.buying_behavior,
        "decision_factor": profile.decision_factor,
        "shopping_preference": profile.shopping_preference,
        "digital_time": profile.digital_time,
        "content_preference": profile.content_preference,
        "interaction_style": profile.interaction_style,
        "influencer_type": profile.influencer_type,
    }


def following_count(user_id: int) -> int:
    """Execute the `following_count` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return FollowRepository.get_following_count(user_id)


def followers_count(user_id: int) -> int:
    """Execute the `followers_count` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return FollowRepository.get_followers_count(user_id)


__all__ = [
    "PROFILE_OPTIONS",
    "normalize_ai_profile_payload",
    "needs_profile",
    "save_profile",
    "profile_to_dict",
    "merge_profile_payload",
]
