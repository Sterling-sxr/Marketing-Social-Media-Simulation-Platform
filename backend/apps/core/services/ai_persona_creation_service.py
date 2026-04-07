"""Helpers for guided and AI-assisted AI persona creation flows."""
from __future__ import annotations

import json
import logging
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


def preview_guided_personas(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
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
