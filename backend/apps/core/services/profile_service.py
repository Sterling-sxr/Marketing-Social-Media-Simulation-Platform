"""Services for managing user profiles."""
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


def needs_profile(user) -> bool:
    """First-login gating removed; keep for backward compatibility."""
    return False


def merge_profile_payload(payload: dict[str, Any], base=None) -> dict[str, Any]:
    """Normalize profile payload while preserving existing values."""
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
    """Save user profile data (normalize payload and delegate to the repository)."""
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
    """Return how many other users this user follows."""
    return FollowRepository.get_following_count(user_id)


def followers_count(user_id: int) -> int:
    """Return how many followers this user has."""
    return FollowRepository.get_followers_count(user_id)


__all__ = [
    "PROFILE_OPTIONS",
    "needs_profile",
    "save_profile",
    "profile_to_dict",
    "merge_profile_payload",
]
