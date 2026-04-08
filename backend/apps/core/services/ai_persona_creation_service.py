"""Helpers for guided and AI-assisted AI persona creation flows."""
from __future__ import annotations

import json
import logging
import random
from typing import Any

from django.conf import settings
from django.utils.text import slugify

from ..repositories import CourseAIUserRepository
from .ai_user_service import (
    create_course_ai_user,
    ensure_ai_user_username_available,
    ensure_can_manage_course_ai_users,
    normalize_ai_user_payload,
    serialize_ai_user_draft,
)
from .profile_service import PROFILE_OPTIONS

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None  # type: ignore

logger = logging.getLogger(__name__)

MAX_PERSONA_PREVIEW_COUNT = 100
_client_cache: OpenAI | None = None  # type: ignore[assignment]

SMART_GENERATE_MODES = {"broad_coverage", "focused_theme"}
SMART_GENERATE_GOALS = {"broad_audience", "theme", "conversion_style", "engagement_style"}
SMART_GOAL_LABELS = {
    "broad_audience": "Explore Broad Audience",
    "theme": "Focus on a Theme",
    "conversion_style": "Focus on Conversion Style",
    "engagement_style": "Focus on Engagement Style",
}
SMART_COVERAGE_OPTIONS = {"wide", "balanced", "tight"}
SMART_ACTIVITY_OPTIONS = {"low", "mixed", "high"}
SMART_INTEREST_LEANS = {"mixed", "tech", "lifestyle"}
SMART_THEME_CARDS: dict[str, dict[str, Any]] = {
    "tech_gaming": {
        "label": "Tech & Gaming",
        "interests": ["Technology & Gaming", "Outdoor & Nature", "Travel & Food"],
        "influencer_types": ["Tech & Gaming", "Entertainment", "Business & Finance"],
        "content_preferences": ["Pictures or videos", "Funny short posts/memes"],
        "decision_factors": ["Convenience", "Quality/durability"],
        "buying_behavior": ["Switcher", "Brand loyal"],
    },
    "fashion_shopping": {
        "label": "Fashion & Shopping",
        "interests": ["Fashion & Shopping", "Arts & Culture", "Travel & Food"],
        "influencer_types": ["Fashion & Beauty", "Entertainment", "Eco & Ethical Lifestyle"],
        "content_preferences": ["Pictures or videos", "Detailed reviews or long posts"],
        "decision_factors": ["Brand image", "Price"],
        "buying_behavior": ["Brand loyal", "Switcher"],
    },
    "travel_food": {
        "label": "Travel & Food",
        "interests": ["Travel & Food", "Outdoor & Nature", "Arts & Culture"],
        "influencer_types": ["Travel & Food", "Entertainment", "Eco & Ethical Lifestyle"],
        "content_preferences": ["Pictures or videos", "Thoughtful opinions"],
        "decision_factors": ["Convenience", "Quality/durability"],
        "buying_behavior": ["Switcher", "Brand loyal"],
    },
    "arts_culture": {
        "label": "Arts & Culture",
        "interests": ["Arts & Culture", "Travel & Food", "Politics & Social Issues"],
        "influencer_types": ["Entertainment", "Eco & Ethical Lifestyle", "Travel & Food"],
        "content_preferences": ["Thoughtful opinions", "Detailed reviews or long posts"],
        "decision_factors": ["Quality/durability", "Brand image"],
        "buying_behavior": ["Brand loyal", "Switcher"],
    },
    "social_issues": {
        "label": "Social Issues",
        "interests": ["Politics & Social Issues", "Arts & Culture", "Outdoor & Nature"],
        "influencer_types": ["Eco & Ethical Lifestyle", "Business & Finance", "Entertainment"],
        "content_preferences": ["Thoughtful opinions", "Detailed reviews or long posts"],
        "decision_factors": ["Eco-friendly", "Quality/durability"],
        "buying_behavior": ["Switcher", "Brand loyal"],
    },
    "creator_trend": {
        "label": "Creator / Trend",
        "interests": ["Technology & Gaming", "Fashion & Shopping", "Travel & Food"],
        "influencer_types": ["Entertainment", "Fashion & Beauty", "Tech & Gaming"],
        "content_preferences": ["Funny short posts/memes", "Pictures or videos"],
        "decision_factors": ["Brand image", "Convenience"],
        "buying_behavior": ["Switcher", "Brand loyal"],
    },
}

SMART_DECISION_DRIVER_RULES: dict[str, dict[str, Any]] = {
    "Price": {
        "interests": ["Fashion & Shopping", "Family & Home Life", "Technology & Gaming"],
        "content_preferences": ["Detailed reviews or long posts", "Funny short posts/memes"],
        "influencer_types": ["Fashion & Beauty", "Tech & Gaming", "Entertainment"],
        "buying_behavior": ["Price-sensitive", "Switcher"],
    },
    "Quality/durability": {
        "interests": ["Technology & Gaming", "Outdoor & Nature", "Family & Home Life"],
        "content_preferences": ["Detailed reviews or long posts", "Thoughtful opinions"],
        "influencer_types": ["Tech & Gaming", "Business & Finance", "Eco & Ethical Lifestyle"],
        "buying_behavior": ["Brand loyal", "Switcher"],
    },
    "Brand image": {
        "interests": ["Fashion & Shopping", "Arts & Culture", "Travel & Food"],
        "content_preferences": ["Pictures or videos", "Funny short posts/memes"],
        "influencer_types": ["Fashion & Beauty", "Entertainment", "Travel & Food"],
        "buying_behavior": ["Brand loyal", "Switcher"],
    },
    "Eco-friendly": {
        "interests": ["Politics & Social Issues", "Outdoor & Nature", "Arts & Culture"],
        "content_preferences": ["Thoughtful opinions", "Detailed reviews or long posts"],
        "influencer_types": ["Eco & Ethical Lifestyle", "Business & Finance", "Travel & Food"],
        "buying_behavior": ["Switcher", "Brand loyal"],
    },
    "Convenience": {
        "interests": ["Technology & Gaming", "Travel & Food", "Fashion & Shopping"],
        "content_preferences": ["Pictures or videos", "Funny short posts/memes"],
        "influencer_types": ["Entertainment", "Tech & Gaming", "Travel & Food"],
        "buying_behavior": ["Switcher", "Price-sensitive"],
    },
}

SMART_CONTENT_BIAS_RULES: dict[str, dict[str, Any]] = {
    "Funny short posts/memes": {
        "interests": ["Technology & Gaming", "Fashion & Shopping", "Travel & Food"],
        "decision_factors": ["Convenience", "Price"],
        "influencer_types": ["Entertainment", "Tech & Gaming", "Fashion & Beauty"],
        "interaction_style": ["Like/react to posts", "Share posts with friends"],
    },
    "Pictures or videos": {
        "interests": ["Travel & Food", "Fashion & Shopping", "Technology & Gaming"],
        "decision_factors": ["Convenience", "Brand image"],
        "influencer_types": ["Travel & Food", "Entertainment", "Fashion & Beauty"],
        "interaction_style": ["Like/react to posts", "Comment on posts"],
    },
    "Thoughtful opinions": {
        "interests": ["Politics & Social Issues", "Arts & Culture", "Outdoor & Nature"],
        "decision_factors": ["Eco-friendly", "Quality/durability"],
        "influencer_types": ["Eco & Ethical Lifestyle", "Business & Finance", "Entertainment"],
        "interaction_style": ["Comment on posts", "Share posts with friends"],
    },
    "Detailed reviews or long posts": {
        "interests": ["Technology & Gaming", "Travel & Food", "Family & Home Life"],
        "decision_factors": ["Quality/durability", "Price"],
        "influencer_types": ["Business & Finance", "Tech & Gaming", "Travel & Food"],
        "interaction_style": ["Comment on posts", "Mostly just scroll/watch"],
    },
}

SMART_INTEREST_LEAN_RULES: dict[str, dict[str, Any]] = {
    "mixed": {
        "interests": list(PROFILE_OPTIONS["interests"]),
        "content_preferences": ["Pictures or videos", "Thoughtful opinions"],
        "influencer_types": ["Entertainment", "Travel & Food", "Tech & Gaming"],
    },
    "tech": {
        "interests": ["Technology & Gaming", "Outdoor & Nature", "Politics & Social Issues"],
        "content_preferences": ["Pictures or videos", "Funny short posts/memes"],
        "influencer_types": ["Tech & Gaming", "Business & Finance", "Entertainment"],
    },
    "lifestyle": {
        "interests": ["Travel & Food", "Fashion & Shopping", "Arts & Culture", "Family & Home Life"],
        "content_preferences": ["Pictures or videos", "Thoughtful opinions", "Detailed reviews or long posts"],
        "influencer_types": ["Travel & Food", "Fashion & Beauty", "Eco & Ethical Lifestyle"],
    },
}

SMART_ACTIVITY_RULES: dict[str, dict[str, Any]] = {
    "low": {
        "digital_time": ["About once a week or less", "A few times a week", "About once a day"],
        "interaction_style": ["Mostly just scroll/watch", "Like/react to posts"],
        "score_seed": {"social_value": 4, "sociability": 3, "openness": 5},
    },
    "mixed": {
        "digital_time": ["About once a day", "Several times a day", "A few times a week"],
        "interaction_style": ["Like/react to posts", "Comment on posts", "Mostly just scroll/watch"],
        "score_seed": {"social_value": 5, "sociability": 5, "openness": 6},
    },
    "high": {
        "digital_time": ["Almost constantly", "Several times a day", "About once a day"],
        "interaction_style": ["Comment on posts", "Share posts with friends", "Like/react to posts"],
        "score_seed": {"social_value": 7, "sociability": 8, "openness": 7},
    },
}

SMART_COVERAGE_RULES: dict[str, dict[str, Any]] = {
    "wide": {"unique_interest_target": 4, "unique_interaction_target": 3, "variance": 2},
    "balanced": {"unique_interest_target": 3, "unique_interaction_target": 2, "variance": 1},
    "tight": {"unique_interest_target": 2, "unique_interaction_target": 2, "variance": 1},
}

INTEREST_DISPLAY_ROOTS = {
    "Technology & Gaming": "Tech Explorer",
    "Travel & Food": "Taste Traveler",
    "Arts & Culture": "Creative Observer",
    "Fashion & Shopping": "Style Watcher",
    "Politics & Social Issues": "Issue Follower",
    "Outdoor & Nature": "Outdoor Drifter",
    "Fitness & Sports": "Active Fan",
    "Family & Home Life": "Home Planner",
}

GUIDED_TEMPLATES: dict[str, dict[str, Any]] = {
    "undergraduate-heavy": {
        "label": "Undergraduate-heavy cohort",
        "age_groups": ["Gen Z (16-28)", "Gen Y (29-44)"],
        "education_levels": ["University Education", "High School"],
        "income_levels": ["Under $30K /year", "$30K - $49,999 /year"],
        "digital_times": ["Almost constantly", "Several times a day"],
        "content_preferences": ["Pictures or videos", "Funny short posts/memes"],
        "interaction_styles": ["Like/react to posts", "Comment on posts"],
        "influencer_types": ["Entertainment", "Tech & Gaming"],
        "shopping_frequency": ["Sometimes", "Often"],
        "buying_behavior": ["Switcher", "Price-sensitive"],
        "decision_factors": ["Convenience", "Price"],
        "shopping_preferences": ["Both online and in stores", "Online only"],
        "interests": ["Technology & Gaming", "Travel & Food", "Fitness & Sports"],
        "score_seed": {"social_value": 6, "sociability": 7, "openness": 8},
    },
    "mixed-interests": {
        "label": "Mixed interests cohort",
        "age_groups": ["Gen Z (16-28)", "Gen Y (29-44)", "Gen X (45-60)"],
        "education_levels": ["University Education", "Vocational / TAFE"],
        "income_levels": ["$30K - $49,999 /year", "$50K - $89,999 /year"],
        "digital_times": ["Several times a day", "About once a day"],
        "content_preferences": ["Pictures or videos", "Thoughtful opinions"],
        "interaction_styles": ["Comment on posts", "Mostly just scroll/watch"],
        "influencer_types": ["Travel & Food", "Entertainment", "Eco & Ethical Lifestyle"],
        "shopping_frequency": ["Sometimes", "Often"],
        "buying_behavior": ["Switcher", "Brand loyal"],
        "decision_factors": ["Quality/durability", "Convenience"],
        "shopping_preferences": ["Both online and in stores", "Online only"],
        "interests": ["Arts & Culture", "Technology & Gaming", "Outdoor & Nature", "Politics & Social Issues"],
        "score_seed": {"social_value": 5, "sociability": 6, "openness": 7},
    },
    "marketing-audience": {
        "label": "Marketing audience cohort",
        "age_groups": ["Gen Z (16-28)", "Gen Y (29-44)"],
        "education_levels": ["University Education", "Post-graduate Education"],
        "income_levels": ["$50K - $89,999 /year", "$90K - $149,999 /year"],
        "digital_times": ["Several times a day", "About once a day"],
        "content_preferences": ["Pictures or videos", "Detailed reviews or long posts"],
        "interaction_styles": ["Like/react to posts", "Share posts with friends"],
        "influencer_types": ["Business & Finance", "Travel & Food", "Fashion & Beauty"],
        "shopping_frequency": ["Often", "Very often"],
        "buying_behavior": ["Brand loyal", "Switcher"],
        "decision_factors": ["Brand image", "Quality/durability"],
        "shopping_preferences": ["Online only", "Both online and in stores"],
        "interests": ["Fashion & Shopping", "Travel & Food", "Technology & Gaming"],
        "score_seed": {"social_value": 7, "sociability": 6, "openness": 6},
    },
    "creator-community": {
        "label": "Creator community cohort",
        "age_groups": ["Gen Z (16-28)", "Gen Y (29-44)"],
        "education_levels": ["University Education", "Post-graduate Education"],
        "income_levels": ["$30K - $49,999 /year", "$50K - $89,999 /year"],
        "digital_times": ["Almost constantly", "Several times a day"],
        "content_preferences": ["Pictures or videos", "Thoughtful opinions"],
        "interaction_styles": ["Comment on posts", "Share posts with friends"],
        "influencer_types": ["Entertainment", "Travel & Food", "Tech & Gaming"],
        "shopping_frequency": ["Sometimes", "Often"],
        "buying_behavior": ["Switcher", "Brand loyal"],
        "decision_factors": ["Brand image", "Convenience"],
        "shopping_preferences": ["Online only", "Both online and in stores"],
        "interests": ["Arts & Culture", "Technology & Gaming", "Travel & Food"],
        "score_seed": {"social_value": 6, "sociability": 8, "openness": 8},
    },
}


def _get_client() -> OpenAI | None:  # type: ignore[return-type]
    api_key = getattr(settings, "DEEPSEEK_API_KEY", None)
    if not api_key:
        return None
    if OpenAI is None:
        logger.warning("openai package is not installed; persona generation unavailable.")
        return None
    global _client_cache
    if _client_cache is None:
        base_url = getattr(settings, "DEEPSEEK_API_BASE", "https://api.deepseek.com")
        _client_cache = OpenAI(api_key=api_key, base_url=base_url)
    return _client_cache


def _validate_count(value: Any) -> int:
    try:
        count = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Field count must be an integer.") from exc
    if count < 1 or count > MAX_PERSONA_PREVIEW_COUNT:
        raise ValueError(f"Field count must be between 1 and {MAX_PERSONA_PREVIEW_COUNT}.")
    return count


def _cycle(options: list[str], index: int, fallback_key: str) -> str:
    values = [value for value in options if value]
    if not values:
        defaults = PROFILE_OPTIONS[fallback_key]
        values = list(defaults)
    return values[index % len(values)]


def _pick_interests(options: list[str], index: int) -> list[str]:
    values = [value for value in options if value]
    if not values:
        values = list(PROFILE_OPTIONS["interests"])
    first = values[index % len(values)]
    second = values[(index + 1) % len(values)]
    return [first] if first == second else [first, second]


def _build_guided_draft(*, template_id: str, template: dict[str, Any], payload: dict[str, Any], course_id: int, index: int, seen: set[str]) -> dict[str, Any]:
    audience_theme = (payload.get("audience_theme") or "").strip()
    interest_mix = payload.get("interest_mix") or template["interests"]
    age_mix = payload.get("age_mix") or template["age_groups"]
    content_preference = (payload.get("content_preference") or "").strip()
    digital_time = (payload.get("digital_time") or "").strip()
    base_slug = slugify(audience_theme or template_id) or template_id
    username = ensure_ai_user_username_available(
        course_id=course_id,
        username=f"{base_slug}-{index + 1}",
        seen_usernames=seen,
    )
    score_seed = template["score_seed"]
    display_root = audience_theme or template["label"]
    return {
        "username": username,
        "display_name": f"{display_root} {index + 1}",
        "gender": _cycle(PROFILE_OPTIONS["genders"], index, "genders"),
        "city": _cycle(PROFILE_OPTIONS["cities"], index, "cities"),
        "age_group": _cycle(list(age_mix), index, "age_groups"),
        "education_level": _cycle(template["education_levels"], index, "education_levels"),
        "income_level": _cycle(template["income_levels"], index, "income_levels"),
        "social_value": min(10, score_seed["social_value"] + (index % 2)),
        "sociability": min(10, score_seed["sociability"] + (index % 3)),
        "openness": min(10, score_seed["openness"] + (index % 2)),
        "content_preference": content_preference or _cycle(template["content_preferences"], index, "content_preference"),
        "interests": _pick_interests(list(interest_mix), index),
        "shopping_frequency": _cycle(template["shopping_frequency"], index, "shopping_frequency"),
        "buying_behavior": _cycle(template["buying_behavior"], index, "buying_behavior"),
        "decision_factor": _cycle(template["decision_factors"], index, "decision_factors"),
        "shopping_preference": _cycle(template["shopping_preferences"], index, "shopping_preference"),
        "digital_time": digital_time or _cycle(template["digital_times"], index, "digital_time"),
        "interaction_style": _cycle(template["interaction_styles"], index, "interaction_style"),
        "influencer_type": _cycle(template["influencer_types"], index, "influencer_type"),
        "notes": f"Guided creation template: {template['label']}" + (f" | Theme: {audience_theme}" if audience_theme else ""),
    }


def _normalize_preview_items(*, course_id: int, raw_items: list[dict[str, Any]], warnings: list[str] | None = None) -> dict[str, Any]:
    seen_usernames: set[str] = set()
    normalized_items: list[dict[str, Any]] = []
    all_warnings = list(warnings or [])

    for index, raw_item in enumerate(raw_items, start=1):
        current_warnings: list[str] = []
        try:
            normalized = normalize_ai_user_payload(raw_item, require_username=True)
            normalized["username"] = ensure_ai_user_username_available(
                course_id=course_id,
                username=normalized["username"],
                seen_usernames=seen_usernames,
            )
            normalized_items.append(serialize_ai_user_draft(normalized, warnings=current_warnings))
        except ValueError as exc:
            username = (raw_item.get("username") or f"item-{index}").strip() or f"item-{index}"
            all_warnings.append(f"Skipped draft `{username}`: {exc}")

    return {
        "items": normalized_items,
        "warnings": all_warnings,
    }


def _is_smart_generate_payload(payload: dict[str, Any]) -> bool:
    goal = (payload.get("goal") or "").strip()
    mode = (payload.get("mode") or "").strip()
    template_id = (payload.get("template_id") or "").strip()
    return goal in SMART_GENERATE_GOALS or mode in SMART_GENERATE_MODES or (not goal and not mode and not template_id)


def _get_profile_value(payload: dict[str, Any], field: str, key: str) -> str:
    value = (payload.get(field) or "").strip()
    if value and value not in PROFILE_OPTIONS[key]:
        raise ValueError(f"Field `{field}` must be one of the supported profile options.")
    return value


def _build_demographic_pools(payload: dict[str, Any]) -> dict[str, list[str]]:
    gender = _get_profile_value(payload, "gender", "genders")
    age_group = _get_profile_value(payload, "age_group", "age_groups")
    education_level = _get_profile_value(payload, "education_level", "education_levels")
    income_level = _get_profile_value(payload, "income_level", "income_levels")
    return {
        "gender_pool": [gender] if gender else list(PROFILE_OPTIONS["genders"]),
        "age_pool": [age_group] if age_group else list(PROFILE_OPTIONS["age_groups"]),
        "education_pool": [education_level] if education_level else list(PROFILE_OPTIONS["education_levels"]),
        "income_pool": [income_level] if income_level else list(PROFILE_OPTIONS["income_levels"]),
    }


def _merge_pool(preferred: list[str], fallback_key: str) -> list[str]:
    return list(dict.fromkeys([value for value in preferred if value] + list(PROFILE_OPTIONS[fallback_key])))


def _goal_from_legacy_mode(mode: str) -> str | None:
    if mode == "broad_coverage":
        return "broad_audience"
    if mode == "focused_theme":
        return "theme"
    return None


def _build_smart_generation_profile(payload: dict[str, Any]) -> dict[str, Any]:
    legacy_mode = (payload.get("mode") or "").strip()
    goal = (payload.get("goal") or "").strip() or _goal_from_legacy_mode(legacy_mode) or "broad_audience"
    if goal not in SMART_GENERATE_GOALS:
        raise ValueError(f"Unknown goal: {goal}")
    count = _validate_count(payload.get("count"))
    activity_level = (payload.get("activity_level") or "").strip() or "mixed"
    if activity_level not in SMART_ACTIVITY_OPTIONS:
        raise ValueError("Field `activity_level` must be one of: low, mixed, high.")
    demographics = _build_demographic_pools(payload)
    activity_rule = SMART_ACTIVITY_RULES[activity_level]

    profile: dict[str, Any] = {
        "goal": goal,
        "goal_label": SMART_GOAL_LABELS[goal],
        "count": count,
        "activity_level": activity_level,
        "activity_rule": activity_rule,
        "coverage_rule": SMART_COVERAGE_RULES["balanced"],
        "interest_pool": list(PROFILE_OPTIONS["interests"]),
        "influencer_pool": list(PROFILE_OPTIONS["influencer_type"]),
        "content_pool": list(PROFILE_OPTIONS["content_preference"]),
        "decision_pool": list(PROFILE_OPTIONS["decision_factors"]),
        "buying_pool": list(PROFILE_OPTIONS["buying_behavior"]),
        "interaction_pool": list(activity_rule["interaction_style"]),
        "theme_card": "",
        "theme_label": "",
        "interest_lean": "",
        "coverage": "",
        "tightness": "",
        "decision_driver": "",
        "content_preference_bias": "",
        "interaction_intensity": "",
        **demographics,
    }

    if goal == "broad_audience":
        coverage = (payload.get("coverage") or "").strip() or "balanced"
        if coverage not in SMART_COVERAGE_OPTIONS:
            raise ValueError("Field `coverage` must be one of: wide, balanced, tight.")
        interest_lean = (payload.get("interest_lean") or "").strip() or "mixed"
        if interest_lean not in SMART_INTEREST_LEANS:
            raise ValueError("Field `interest_lean` must be one of: mixed, tech, lifestyle.")
        lean_rule = SMART_INTEREST_LEAN_RULES[interest_lean]
        profile.update(
            {
                "coverage": coverage,
                "interest_lean": interest_lean,
                "coverage_rule": SMART_COVERAGE_RULES[coverage],
                "interest_pool": _merge_pool(list(lean_rule["interests"]), "interests"),
                "influencer_pool": _merge_pool(list(lean_rule["influencer_types"]), "influencer_type"),
                "content_pool": _merge_pool(list(lean_rule["content_preferences"]), "content_preference"),
            }
        )
        return profile

    if goal == "theme":
        theme_card = (payload.get("theme_card") or "").strip()
        if not theme_card:
            raise ValueError("Field `theme_card` is required for theme goal.")
        if theme_card not in SMART_THEME_CARDS:
            raise ValueError(f"Unknown theme_card: {theme_card}")
        tightness = (payload.get("tightness") or payload.get("coverage") or "").strip() or "balanced"
        if tightness not in SMART_COVERAGE_OPTIONS:
            raise ValueError("Field `tightness` must be one of: wide, balanced, tight.")
        theme_rule = SMART_THEME_CARDS[theme_card]
        profile.update(
            {
                "theme_card": theme_card,
                "theme_label": theme_rule["label"],
                "tightness": tightness,
                "coverage_rule": SMART_COVERAGE_RULES[tightness],
                "interest_pool": _merge_pool(list(theme_rule["interests"]), "interests"),
                "influencer_pool": _merge_pool(list(theme_rule["influencer_types"]), "influencer_type"),
                "content_pool": _merge_pool(list(theme_rule["content_preferences"]), "content_preference"),
                "decision_pool": _merge_pool(list(theme_rule["decision_factors"]), "decision_factors"),
                "buying_pool": _merge_pool(list(theme_rule["buying_behavior"]), "buying_behavior"),
            }
        )
        return profile

    if goal == "conversion_style":
        decision_driver = (payload.get("decision_driver") or "").strip() or "Price"
        if decision_driver not in PROFILE_OPTIONS["decision_factors"]:
            raise ValueError("Field `decision_driver` must be one of the supported decision factors.")
        tightness = (payload.get("tightness") or "").strip() or "balanced"
        if tightness not in SMART_COVERAGE_OPTIONS:
            raise ValueError("Field `tightness` must be one of: wide, balanced, tight.")
        rule = SMART_DECISION_DRIVER_RULES[decision_driver]
        profile.update(
            {
                "decision_driver": decision_driver,
                "tightness": tightness,
                "coverage_rule": SMART_COVERAGE_RULES[tightness],
                "interest_pool": _merge_pool(list(rule["interests"]), "interests"),
                "influencer_pool": _merge_pool(list(rule["influencer_types"]), "influencer_type"),
                "content_pool": _merge_pool(list(rule["content_preferences"]), "content_preference"),
                "decision_pool": [decision_driver] + [value for value in PROFILE_OPTIONS["decision_factors"] if value != decision_driver],
                "buying_pool": _merge_pool(list(rule["buying_behavior"]), "buying_behavior"),
            }
        )
        return profile

    content_preference_bias = (payload.get("content_preference_bias") or "").strip() or "Pictures or videos"
    if content_preference_bias not in PROFILE_OPTIONS["content_preference"]:
        raise ValueError(
            "Field `content_preference_bias` must be one of the supported content preference values."
        )
    interaction_intensity = (payload.get("interaction_intensity") or "").strip() or "mixed"
    if interaction_intensity not in SMART_ACTIVITY_OPTIONS:
        raise ValueError("Field `interaction_intensity` must be one of: low, mixed, high.")
    content_rule = SMART_CONTENT_BIAS_RULES[content_preference_bias]
    profile.update(
        {
            "content_preference_bias": content_preference_bias,
            "interaction_intensity": interaction_intensity,
            "coverage_rule": SMART_COVERAGE_RULES["balanced"],
            "interest_pool": _merge_pool(list(content_rule["interests"]), "interests"),
            "influencer_pool": _merge_pool(list(content_rule["influencer_types"]), "influencer_type"),
            "content_pool": [content_preference_bias]
            + [value for value in PROFILE_OPTIONS["content_preference"] if value != content_preference_bias],
            "decision_pool": _merge_pool(list(content_rule["decision_factors"]), "decision_factors"),
            "interaction_pool": list(
                dict.fromkeys(content_rule["interaction_style"] + SMART_ACTIVITY_RULES[interaction_intensity]["interaction_style"])
            ),
        }
    )
    return profile


def _build_interest_sequence(profile: dict[str, Any]) -> list[str]:
    interest_pool = list(profile["interest_pool"])
    unique_target = min(profile["coverage_rule"]["unique_interest_target"], len(interest_pool))
    if unique_target <= 0:
        return list(PROFILE_OPTIONS["interests"])
    if profile["goal"] == "theme":
        base = interest_pool[:unique_target]
    else:
        base = interest_pool[:]
        random.shuffle(base)
        base = base[:unique_target]
    return base or list(PROFILE_OPTIONS["interests"])


def _choose_with_cycle(values: list[str], index: int, offset: int = 0) -> str:
    if not values:
        return ""
    return values[(index + offset) % len(values)]


def _compute_score(base: int, variance: int, index: int, shift: int = 0) -> int:
    raw = base + ((index + shift) % (variance * 2 + 1)) - variance
    return max(1, min(10, raw))


def _compose_smart_drafts(*, profile: dict[str, Any], course_id: int) -> list[dict[str, Any]]:
    seen_usernames: set[str] = set()
    used_signatures: set[tuple[str, str, str]] = set()
    interest_sequence = _build_interest_sequence(profile)
    interaction_pool = list(profile["interaction_pool"])
    if profile["goal"] == "broad_audience" and profile["coverage"] == "wide":
        interaction_pool = list(dict.fromkeys(interaction_pool + ["Mostly just scroll/watch"]))

    drafts: list[dict[str, Any]] = []
    for index in range(profile["count"]):
        primary_interest = _choose_with_cycle(interest_sequence, index)
        secondary_interest = _choose_with_cycle(profile["interest_pool"], index, offset=1)
        interests = [primary_interest] if primary_interest == secondary_interest else [primary_interest, secondary_interest]

        content_preference = _choose_with_cycle(profile["content_pool"], index)
        interaction_style = _choose_with_cycle(
            interaction_pool,
            index,
            offset=index % max(1, profile["coverage_rule"]["unique_interaction_target"]),
        )
        signature = (primary_interest, interaction_style, content_preference)
        if signature in used_signatures:
            interaction_style = _choose_with_cycle(interaction_pool, index, offset=2)
            signature = (primary_interest, interaction_style, content_preference)
        used_signatures.add(signature)

        display_root = INTEREST_DISPLAY_ROOTS.get(primary_interest, profile["goal_label"])
        username = ensure_ai_user_username_available(
            course_id=course_id,
            username=slugify(f"{display_root}-{index + 1}") or f"persona-{index + 1}",
            seen_usernames=seen_usernames,
        )
        score_seed = profile["activity_rule"]["score_seed"]
        variance = profile["coverage_rule"]["variance"]
        notes_parts = [f"Smart generate goal: {profile['goal_label']}", f"Activity: {profile['activity_level']}"]
        if profile["coverage"]:
            notes_parts.append(f"Coverage: {profile['coverage']}")
        if profile["interest_lean"]:
            notes_parts.append(f"Interest lean: {profile['interest_lean']}")
        if profile["theme_label"]:
            notes_parts.append(f"Theme: {profile['theme_label']}")
        if profile["tightness"]:
            notes_parts.append(f"Tightness: {profile['tightness']}")
        if profile["decision_driver"]:
            notes_parts.append(f"Decision driver: {profile['decision_driver']}")
        if profile["content_preference_bias"]:
            notes_parts.append(f"Content bias: {profile['content_preference_bias']}")
        if profile["interaction_intensity"]:
            notes_parts.append(f"Interaction intensity: {profile['interaction_intensity']}")
        notes = " | ".join(notes_parts)

        drafts.append(
            {
                "username": username,
                "display_name": f"{display_root} {index + 1}",
                "gender": _choose_with_cycle(profile["gender_pool"], index),
                "city": _choose_with_cycle(PROFILE_OPTIONS["cities"], index, offset=variance),
                "age_group": _choose_with_cycle(profile["age_pool"], index),
                "education_level": _choose_with_cycle(profile["education_pool"], index),
                "income_level": _choose_with_cycle(profile["income_pool"], index, offset=1),
                "social_value": _compute_score(score_seed["social_value"], variance, index),
                "sociability": _compute_score(score_seed["sociability"], variance, index, shift=1),
                "openness": _compute_score(score_seed["openness"], variance, index, shift=2),
                "content_preference": content_preference,
                "interests": interests,
                "shopping_frequency": _choose_with_cycle(PROFILE_OPTIONS["shopping_frequency"], index),
                "buying_behavior": _choose_with_cycle(profile["buying_pool"], index),
                "decision_factor": _choose_with_cycle(profile["decision_pool"], index),
                "shopping_preference": _choose_with_cycle(PROFILE_OPTIONS["shopping_preference"], index),
                "digital_time": _choose_with_cycle(profile["activity_rule"]["digital_time"], index),
                "interaction_style": interaction_style,
                "influencer_type": _choose_with_cycle(profile["influencer_pool"], index),
                "notes": notes,
            }
        )
    return drafts


def _preview_smart_generated_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    ensure_can_manage_course_ai_users(user=user, course_id=course_id)
    profile = _build_smart_generation_profile(payload)
    drafts = _compose_smart_drafts(profile=profile, course_id=course_id)
    normalized = _normalize_preview_items(course_id=course_id, raw_items=drafts)
    warnings = list(normalized["warnings"])
    warnings.append(f"{profile['goal_label']} preview generated with rule-based persona composition.")
    return {
        "items": normalized["items"],
        "count": len(normalized["items"]),
        "warnings": warnings,
        "limits": {"max_count": MAX_PERSONA_PREVIEW_COUNT, "mode": "guided"},
        "smart_profile": {
            "goal": profile["goal"],
            "goal_label": profile["goal_label"],
            "mode": "focused_theme" if profile["goal"] == "theme" else "broad_coverage",
            "coverage": profile["coverage"],
            "activity_level": profile["activity_level"],
            "interest_lean": profile["interest_lean"],
            "theme_card": profile["theme_card"],
            "theme_label": profile["theme_label"],
            "tightness": profile["tightness"],
            "decision_driver": profile["decision_driver"],
            "content_preference_bias": profile["content_preference_bias"],
            "interaction_intensity": profile["interaction_intensity"],
            "profile_label": profile["goal_label"],
        },
    }


def preview_guided_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    if _is_smart_generate_payload(payload):
        return _preview_smart_generated_personas(user=user, course_id=course_id, payload=payload)

    ensure_can_manage_course_ai_users(user=user, course_id=course_id)
    template_id = (payload.get("template_id") or "").strip()
    if not template_id:
        raise ValueError("Field `template_id` is required.")
    template = GUIDED_TEMPLATES.get(template_id)
    if not template:
        raise ValueError(f"Unknown template_id: {template_id}")
    count = _validate_count(payload.get("count"))
    seen: set[str] = set()
    drafts = [
        _build_guided_draft(
            template_id=template_id,
            template=template,
            payload=payload,
            course_id=course_id,
            index=index,
            seen=seen,
        )
        for index in range(count)
    ]
    normalized = _normalize_preview_items(course_id=course_id, raw_items=drafts)
    return {
        "items": normalized["items"],
        "count": len(normalized["items"]),
        "warnings": normalized["warnings"],
        "limits": {"max_count": MAX_PERSONA_PREVIEW_COUNT, "mode": "guided"},
    }


def _commit_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    ensure_can_manage_course_ai_users(user=user, course_id=course_id)
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("Field `items` must be a non-empty array.")

    created_items: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, item in enumerate(items, start=1):
        try:
            normalized = normalize_ai_user_payload(item, require_username=True)
            created = create_course_ai_user(user=user, course_id=course_id, payload=normalized)
            created_items.append(created)
        except Exception as exc:  # noqa: BLE001
            username = (item.get("username") or f"item-{index}").strip() or f"item-{index}"
            errors.append(f"Item {index} ({username}): {exc}")

    return {
        "created": len(created_items),
        "items": created_items,
        "errors": errors,
    }


def commit_guided_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return _commit_personas(user=user, course_id=course_id, payload=payload)


def _build_generation_prompt(*, payload: dict[str, Any], course) -> str:
    count = _validate_count(payload.get("count"))
    scenario_prompt = (payload.get("scenario_prompt") or "").strip()
    template_id = (payload.get("template_id") or "").strip()
    constraints = payload.get("constraints") or {}
    if constraints and not isinstance(constraints, dict):
        raise ValueError("Field `constraints` must be an object.")

    allowed = {
        "genders": PROFILE_OPTIONS["genders"],
        "cities": PROFILE_OPTIONS["cities"],
        "age_groups": PROFILE_OPTIONS["age_groups"],
        "education_levels": PROFILE_OPTIONS["education_levels"],
        "income_levels": PROFILE_OPTIONS["income_levels"],
        "interests": PROFILE_OPTIONS["interests"],
        "shopping_frequency": PROFILE_OPTIONS["shopping_frequency"],
        "buying_behavior": PROFILE_OPTIONS["buying_behavior"],
        "decision_factors": PROFILE_OPTIONS["decision_factors"],
        "shopping_preference": PROFILE_OPTIONS["shopping_preference"],
        "digital_time": PROFILE_OPTIONS["digital_time"],
        "content_preference": PROFILE_OPTIONS["content_preference"],
        "interaction_style": PROFILE_OPTIONS["interaction_style"],
        "influencer_type": PROFILE_OPTIONS["influencer_type"],
    }
    return (
        "Generate AI persona drafts for a university social media simulation platform.\n"
        f"Course: {course.course_code} - {course.name}\n"
        f"Count: {count}\n"
        f"Template seed: {template_id or 'none'}\n"
        f"Scenario prompt: {scenario_prompt or 'none'}\n"
        f"Constraints: {json.dumps(constraints, ensure_ascii=False)}\n"
        "Return strict JSON as an array of persona objects.\n"
        "Use only the allowed categorical values listed below and keep numeric scores between 1 and 10.\n"
        "Each persona must include: username, display_name, gender, city, age_group, education_level, income_level, "
        "social_value, sociability, openness, content_preference, interests, shopping_frequency, buying_behavior, "
        "decision_factor, shopping_preference, digital_time, interaction_style, influencer_type, notes.\n"
        f"Allowed values: {json.dumps(allowed, ensure_ascii=False)}"
    )


def _request_generated_drafts(*, payload: dict[str, Any], course, existing_usernames: set[str]) -> list[dict[str, Any]]:
    client = _get_client()
    if client is None:
        raise RuntimeError("AI persona generation is unavailable.")

    prompt = _build_generation_prompt(payload=payload, course=course)
    model_name = getattr(settings, "DEEPSEEK_MODEL_NAME", "deepseek-chat")
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "You generate JSON-only persona drafts."},
            {"role": "user", "content": prompt},
        ],
        stream=False,
        response_format={"type": "json_object"},
    )

    message = response.choices[0].message
    content = getattr(message, "parsed", None) or message.content
    if isinstance(content, dict):
        if isinstance(content.get("items"), list):
            return list(content["items"])
        if isinstance(content.get("personas"), list):
            return list(content["personas"])
        raise RuntimeError("AI persona generation returned an unexpected JSON shape.")

    raw = (content or "").strip()
    if not raw:
        raise RuntimeError("AI persona generation returned an empty response.")
    data = json.loads(raw)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("items"), list):
            return list(data["items"])
        if isinstance(data.get("personas"), list):
            return list(data["personas"])
    raise RuntimeError("AI persona generation returned an unexpected JSON shape.")


def preview_generated_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    course = ensure_can_manage_course_ai_users(user=user, course_id=course_id)
    _validate_count(payload.get("count"))
    existing_usernames = {item.username.lower() for item in CourseAIUserRepository.list_for_course(course_id)}
    raw_items = _request_generated_drafts(payload=payload, course=course, existing_usernames=existing_usernames)
    normalized = _normalize_preview_items(course_id=course_id, raw_items=raw_items)
    return {
        "items": normalized["items"],
        "count": len(normalized["items"]),
        "warnings": normalized["warnings"],
        "limits": {"max_count": MAX_PERSONA_PREVIEW_COUNT, "mode": "generated"},
    }


def commit_generated_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return _commit_personas(user=user, course_id=course_id, payload=payload)


__all__ = [
    "GUIDED_TEMPLATES",
    "MAX_PERSONA_PREVIEW_COUNT",
    "commit_generated_personas",
    "commit_guided_personas",
    "preview_generated_personas",
    "preview_guided_personas",
]
