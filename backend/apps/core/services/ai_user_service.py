"""Services for managing course-level AI users."""
from __future__ import annotations

import csv
import io
import secrets
from typing import Any, Iterable

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify

from ..repositories import (
    CourseAIUser,
    CourseAIUserIdentityRepository,
    CourseAIUserRepository,
    CourseMemberRepository,
    CourseRepository,
    create_user,
)
from .profile_service import PROFILE_OPTIONS

AI_USER_NUMERIC_FIELDS = ("social_value", "sociability", "openness")
AI_USER_TEXT_FIELDS = (
    "gender",
    "city",
    "age_group",
    "education_level",
    "income_level",
    "content_preference",
    "shopping_frequency",
    "buying_behavior",
    "decision_factor",
    "shopping_preference",
    "digital_time",
    "interaction_style",
    "influencer_type",
)
AI_USER_LIST_FIELDS = ("interests",)
ALL_AI_USER_FIELDS = (
    "username",
    "display_name",
    *AI_USER_TEXT_FIELDS,
    *AI_USER_NUMERIC_FIELDS,
    *AI_USER_LIST_FIELDS,
    "notes",
)


class CourseAINotFoundError(ValueError):
    """Raised when course AI user is not found."""


def _generate_auth_username(course, ai_username: str) -> str:
    UserModel = get_user_model()
    base_token = slugify(ai_username) or slugify(course.course_code or "") or ""
    if not base_token:
        base_token = f"ai-user-{course.id}"
    base = f"ai_{course.id}_{base_token}".lower()
    candidate = base
    counter = 1
    while UserModel.objects.filter(username__iexact=candidate).exists():
        counter += 1
        candidate = f"{base}_{counter}"
    return candidate


def _generate_auth_email(course, username: str) -> str:
    course_slug = slugify(course.course_code or str(course.id)) or f"course{course.id}"
    return f"{username}@{course_slug}.ai.local"


def _ensure_identity(ai_user: CourseAIUser, course) -> None:
    identity = getattr(ai_user, "identity", None)
    if identity and identity.user:
        return

    system_username = _generate_auth_username(course, ai_user.username)
    email = _generate_auth_email(course, system_username)
    password = secrets.token_urlsafe(20)
    creation = create_user(username=system_username, email=email, password=password)
    user = creation.user

    display_name = ai_user.display_name or ai_user.username
    if display_name:
        truncated = display_name[:150]
        if user.first_name != truncated:
            user.first_name = truncated
            user.save(update_fields=["first_name"])

    CourseMemberRepository.get_or_create_member(course.id, user.id, role="student")
    CourseAIUserIdentityRepository.create(ai_user=ai_user, user=user)


def _update_identity(ai_user: CourseAIUser, course) -> None:
    identity = getattr(ai_user, "identity", None)
    if not identity:
        _ensure_identity(ai_user, course)
        return

    user = identity.user
    if not user:
        CourseAIUserIdentityRepository.delete_by_id(identity.id)
        _ensure_identity(ai_user, course)
        return

    desired_display = ai_user.display_name or ai_user.username
    if desired_display:
        truncated = desired_display[:150]
        if user.first_name != truncated:
            user.first_name = truncated
            user.save(update_fields=["first_name"])


def _delete_identity(ai_user: CourseAIUser, course_id: int) -> None:
    identity = getattr(ai_user, "identity", None)
    if not identity:
        return
    user = identity.user
    if user:
        CourseMemberRepository.model.objects.filter(course_id=course_id, user_id=user.id).delete()
        user.delete()
    else:
        CourseAIUserIdentityRepository.delete_by_id(identity.id)


def _get_course(course_id: int):
    course = CourseRepository.get_by_id(course_id)
    if not course:
        raise ValueError("Course not found.")
    return course


def _ensure_can_manage(user, course):
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return
    if getattr(course, "created_by_id", None) == getattr(user, "id", None):
        return
    raise PermissionError("You do not have permission to manage AI users for this course.")


def _normalize_numeric(value: Any, field: str) -> int | None:
    if value in ("", None):
        return None
    try:
        num = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an integer between 1 and 10.") from exc
    if num < 1 or num > 10:
        raise ValueError(f"{field} must be between 1 and 10.")
    return num


def _normalize_interests(value: Any) -> list[str]:
    if value in (None, ""):
        return []
    if isinstance(value, list):
        items = value
    else:
        text = str(value).replace(";", ",")
        items = [item.strip() for item in text.split(",") if item.strip()]
    return items


def _validate_choices(field: str, value: str) -> str:
    if not value:
        return ""
    mapping = {
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
    key = mapping.get(field)
    if key and value not in PROFILE_OPTIONS.get(key, []):
        raise ValueError(f"Invalid value for {field}: {value}")
    return value


def _payload_to_data(payload: dict[str, Any]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for field in ("display_name", "notes"):
        data[field] = (payload.get(field) or "").strip()
    for field in AI_USER_TEXT_FIELDS:
        value = (payload.get(field) or "").strip()
        data[field] = _validate_choices(field, value) if value else ""
    for field in AI_USER_NUMERIC_FIELDS:
        data[field] = _normalize_numeric(payload.get(field), field)
    for field in AI_USER_LIST_FIELDS:
        data[field] = _normalize_interests(payload.get(field))
        # Validate interests items
        allowed = set(PROFILE_OPTIONS.get("interests", []))
        for item in data[field]:
            if item not in allowed:
                raise ValueError(f"Invalid lifestyle interest: {item}")
    return data


def _serialize(ai_user: CourseAIUser) -> dict[str, Any]:
    identity = getattr(ai_user, "identity", None)
    system_user = identity.user if identity else None
    return {
        "id": ai_user.id,
        "course_id": ai_user.course_id,
        "username": ai_user.username,
        "display_name": ai_user.display_name,
        "gender": ai_user.gender,
        "city": ai_user.city,
        "age_group": ai_user.age_group,
        "education_level": ai_user.education_level,
        "income_level": ai_user.income_level,
        "social_value": ai_user.social_value,
        "sociability": ai_user.sociability,
        "openness": ai_user.openness,
        "content_preference": ai_user.content_preference,
        "interests": ai_user.interests,
        "shopping_frequency": ai_user.shopping_frequency,
        "buying_behavior": ai_user.buying_behavior,
        "decision_factor": ai_user.decision_factor,
        "shopping_preference": ai_user.shopping_preference,
        "digital_time": ai_user.digital_time,
        "interaction_style": ai_user.interaction_style,
        "influencer_type": ai_user.influencer_type,
        "notes": ai_user.notes,
        "system_user_id": getattr(system_user, "id", None),
        "system_username": getattr(system_user, "username", ""),
        "created_at": ai_user.created_at.isoformat(),
        "updated_at": ai_user.updated_at.isoformat(),
    }


def get_course_ai_user(*, user, course_id: int, ai_user_id: int) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_can_manage(user, course)
    ai_user = CourseAIUserRepository.get_for_course(course.id, ai_user_id)
    if not ai_user:
        raise CourseAINotFoundError("AI user not found.")
    return _serialize(ai_user)


def list_course_ai_users(*, user, course_id: int, keyword: str | None = None) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_can_manage(user, course)
    if keyword:
        ai_users = CourseAIUserRepository.search(course_id, keyword)
    else:
        ai_users = CourseAIUserRepository.list_for_course(course_id)
    return {
        "course": {
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "term": course.term,
        },
        "items": [_serialize(ai_user) for ai_user in ai_users],
        "count": len(ai_users),
    }


@transaction.atomic
def create_course_ai_user(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_can_manage(user, course)

    username = (payload.get("username") or "").strip()
    if not username:
        raise ValueError("Username is required.")
    if CourseAIUserRepository.exists_username(course_id=course.id, username=username):
        raise ValueError("An AI user with the same username already exists in this course.")

    data = _payload_to_data(payload)
    ai_user = CourseAIUserRepository.create(
        course=course,
        created_by=user if getattr(user, "id", None) else None,
        username=username,
        **data,
    )
    _ensure_identity(ai_user, course)
    refreshed = CourseAIUserRepository.get_for_course(course.id, ai_user.id) or ai_user
    return _serialize(refreshed)


@transaction.atomic
def update_course_ai_user(*, user, course_id: int, ai_user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_can_manage(user, course)
    ai_user = CourseAIUserRepository.get_for_course(course.id, ai_user_id)
    if not ai_user:
        raise CourseAINotFoundError("AI user not found.")

    username = (payload.get("username") or ai_user.username).strip()
    if not username:
        raise ValueError("Username is required.")
    if CourseAIUserRepository.exists_username(
        course_id=course.id,
        username=username,
        exclude_id=ai_user.id,
    ):
        raise ValueError("An AI user with the same username already exists in this course.")

    data = _payload_to_data(payload)
    for field, value in data.items():
        setattr(ai_user, field, value)
    ai_user.username = username
    ai_user.save(update_fields=[*data.keys(), "username", "updated_at"])
    _update_identity(ai_user, course)
    refreshed = CourseAIUserRepository.get_for_course(course.id, ai_user.id) or ai_user
    return _serialize(refreshed)


@transaction.atomic
def delete_course_ai_user(*, user, course_id: int, ai_user_id: int) -> None:
    course = _get_course(course_id)
    _ensure_can_manage(user, course)
    ai_user = CourseAIUserRepository.get_for_course(course.id, ai_user_id)
    if not ai_user:
        raise CourseAINotFoundError("AI user not found.")
    _delete_identity(ai_user, course.id)
    CourseAIUserRepository.delete_by_id(ai_user.id)


CSV_COLUMNS = [
    "username",
    "display_name",
    "gender",
    "city",
    "age_group",
    "education_level",
    "income_level",
    "social_value",
    "sociability",
    "openness",
    "content_preference",
    "interests",
    "shopping_frequency",
    "buying_behavior",
    "decision_factor",
    "shopping_preference",
    "digital_time",
    "interaction_style",
    "influencer_type",
    "notes",
]


def _iter_csv_rows(file_bytes: bytes) -> Iterable[dict[str, Any]]:
    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    missing = [col for col in ("username",) if col not in reader.fieldnames]
    if missing:
        raise ValueError(f"Missing required columns in CSV: {', '.join(missing)}")
    for row in reader:
        yield row


@transaction.atomic
def import_course_ai_users(*, user, course_id: int, file_bytes: bytes) -> dict[str, Any]:
    course = _get_course(course_id)
    _ensure_can_manage(user, course)
    if not file_bytes:
        raise ValueError("Please upload a CSV file with data.")

    created = 0
    updated = 0
    errors: list[str] = []

    for index, row in enumerate(_iter_csv_rows(file_bytes), start=2):
        try:
            username = (row.get("username") or "").strip()
            if not username:
                raise ValueError("Username is missing.")
            payload = {key: row.get(key, "") for key in CSV_COLUMNS if key != "username"}
            existing = CourseAIUserRepository.model.objects.filter(
                course_id=course.id, username__iexact=username
            ).first()
            if existing:
                update_course_ai_user(
                    user=user,
                    course_id=course.id,
                    ai_user_id=existing.id,
                    payload={"username": username, **payload},
                )
                updated += 1
            else:
                create_course_ai_user(
                    user=user,
                    course_id=course.id,
                    payload={"username": username, **payload},
                )
                created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Row {index}: {exc}")

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
    }


def ensure_ai_user_identity(ai_user: CourseAIUser) -> None:
    """Public helper to make sure an AI persona has a backing auth user."""
    course = CourseRepository.get_by_id(ai_user.course_id)
    if not course:
        return
    _ensure_identity(ai_user, course)


__all__ = [
    "get_course_ai_user",
    "list_course_ai_users",
    "create_course_ai_user",
    "update_course_ai_user",
    "delete_course_ai_user",
    "import_course_ai_users",
    "ensure_ai_user_identity",
    "CourseAINotFoundError",
    "CSV_COLUMNS",
]
