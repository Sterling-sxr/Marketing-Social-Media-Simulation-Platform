"""Services for per-course profile management."""
from __future__ import annotations

from typing import Any

from django.db import transaction

from ..repositories import (
    CourseProfileRepository,
    CourseRepository,
)
from .profile_service import merge_profile_payload, profile_to_dict


def _get_course_or_raise(course_id: int):
    course = CourseRepository.get_by_id(course_id)
    if not course:
        raise ValueError("Course not found.")
    return course


def _ensure_membership(user_id: int, course_id: int) -> None:
    if not CourseRepository.is_user_member(course_id, user_id):
        raise PermissionError("You are not a member of this course.")


def get_course_profile(*, user, course_id: int) -> dict[str, Any]:
    course = _get_course_or_raise(course_id)
    _ensure_membership(user.id, course_id)

    profile = CourseProfileRepository.get_for_user_course(user.id, course_id)
    response = {
        "course": {
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "term": course.term,
        },
        "profile_completed": bool(profile),
        "profile": profile_to_dict(profile) if profile else None,
    }
    return response


@transaction.atomic
def save_course_profile(*, user, course_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    course = _get_course_or_raise(course_id)
    _ensure_membership(user.id, course_id)

    existing = CourseProfileRepository.get_for_user_course(user.id, course_id)
    profile_data = merge_profile_payload(payload, base=existing)
    profile, _created = CourseProfileRepository.create_or_update(
        user_id=user.id,
        course_id=course_id,
        profile_data=profile_data,
    )
    return {
        "course": {
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "term": course.term,
        },
        "profile": profile_to_dict(profile),
        "profile_completed": True,
    }


__all__ = ["get_course_profile", "save_course_profile"]
