"""Services for listing and joining courses."""
from __future__ import annotations

import random
import string
from datetime import date, datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

from ..repositories import (
    CourseMemberRepository,
    CourseProfileRepository,
    CourseRepository,
)


def list_courses_for_user(user) -> dict[str, Any]:
    """
    Retrieve the user's courses.
    Business logic: separate joined and joinable courses, then normalize the payload.
    """
    # Fetch data via repositories
    joined_courses = CourseRepository.get_user_courses(user.id)
    course_ids = [course.id for course in joined_courses]
    completion_map = (
        CourseProfileRepository.completed_map_for_user(user.id, course_ids)
        if course_ids
        else {}
    )
    available_courses = CourseRepository.get_available_courses(user.id)
    
    # Assemble response objects
    joined = []
    for course in joined_courses:
        role = CourseRepository.get_user_role(course.id, user.id)
        joined.append({
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "term": course.term,
            "join_code": course.join_code,
            "role": role or "student",
            "start_date": course.start_date.isoformat() if getattr(course, "start_date", None) else None,
            "end_date": course.end_date.isoformat() if getattr(course, "end_date", None) else None,
            "read_only": bool(course.end_date and timezone.localdate() > course.end_date),
            "profile_completed": bool(completion_map.get(course.id)),
        })

    available = [
        {
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "term": course.term,
            "join_code": course.join_code,
            "start_date": course.start_date.isoformat() if getattr(course, "start_date", None) else None,
            "end_date": course.end_date.isoformat() if getattr(course, "end_date", None) else None,
            "read_only": bool(course.end_date and timezone.localdate() > course.end_date),
            "profile_completed": False,
        }
        for course in available_courses
    ]
    return {"joined": joined, "available": available}


@transaction.atomic
def join_course_by_code(*, user, join_code: str):
    """
    Join a course using an invite code.
    Business logic: validate the code, prevent duplicates, create membership.
    """
    # Normalize the incoming code
    normalized_code = (join_code or "").strip().upper()
    if not normalized_code:
        raise ValueError("Please enter the course join code.")

    # Query the repository for the course
    course = CourseRepository.get_by_join_code(normalized_code)
    if not course:
        raise ValueError("No course was found for that join code.")

    # Reject duplicate memberships
    if CourseRepository.is_user_member(course.id, user.id):
        raise ValueError("You have already joined this course.")
    
    # Create membership via repository
    membership, _created = CourseMemberRepository.get_or_create_member(
        course.id, user.id, role="student"
    )
    return membership


__all__ = ["list_courses_for_user", "join_course_by_code", "update_course"]


def _generate_join_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def create_course(
    *,
    user,
    course_code: str,
    course_name: str,
    term: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    """
    Create a course.
    Business logic: enforce permissions, validate data, generate invite code, prevent duplicates.
    """
    # Permission check
    if not (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)):
        raise PermissionError("Only administrators can create courses.")

    # Normalize incoming fields
    code = (course_code or "").strip().upper()
    name = (course_name or "").strip()
    term_val = (term or "").strip().upper()
    if not code or not name or not term_val:
        raise ValueError("Please provide the course code, name, and term.")

    # Deduplicate via repository query
    existing = CourseRepository.filter(course_code__iexact=code, term__iexact=term_val)
    if existing:
        raise ValueError("A course with this code already exists for the selected term.")

    # Generate a unique invite code
    join_code = _generate_join_code(8)
    while CourseRepository.get_by_join_code(join_code):
        join_code = _generate_join_code(8)

    # Parse ISO dates
    def _parse_date(value: str | None, *, label: str) -> date:
        if not value:
            raise ValueError(f"Please provide the course {label}.")
        try:
            return datetime.fromisoformat(value).date()
        except Exception as exc:
            raise ValueError(f"{label} must follow YYYY-MM-DD format.") from exc
    start_dt = _parse_date(start_date, label="start date")
    end_dt = _parse_date(end_date, label="end date")
    if end_dt < start_dt:
        raise ValueError("Course end date must be on or after the start date.")

    # Persist course via repository
    course = CourseRepository.create(
        course_code=code,
        name=name,
        term=term_val,
        join_code=join_code,
        start_date=start_dt,
        end_date=end_dt,
        created_by=user,
    )
    
    # Build response payload
    payload = {
        "id": course.id,
        "name": course.name,
        "course_code": course.course_code,
        "term": course.term,
        "join_code": course.join_code,
        "start_date": course.start_date.isoformat(),
        "end_date": course.end_date.isoformat(),
    }
    return payload


def list_managed_courses(*, user) -> list[dict[str, Any]]:
    """
    List courses created by the administrator.
    Business logic: permission check plus response formatting.
    """
    # Permission check
    if not (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)):
        return []
    
    # Fetch courses for this admin
    courses = CourseRepository.get_created_by_user(user.id)
    
    # Format the response
    return [
        {
            "id": c.id,
            "name": c.name,
            "course_code": c.course_code,
            "term": c.term,
            "join_code": c.join_code,
            "start_date": c.start_date.isoformat() if getattr(c, "start_date", None) else None,
            "end_date": c.end_date.isoformat() if getattr(c, "end_date", None) else None,
            "read_only": bool(c.end_date and timezone.localdate() > c.end_date),
        }
        for c in courses
    ]


@transaction.atomic
def update_course(
    *,
    user,
    course_id: int,
    course_code: str,
    course_name: str,
    term: str,
    start_date: str | None,
    end_date: str | None,
) -> dict[str, Any]:
    if not (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)):
        raise PermissionError("Only administrators can update courses.")

    course = CourseRepository.get_by_id(course_id)
    if not course:
        raise ValueError("Course not found.")

    code = (course_code or "").strip().upper()
    name = (course_name or "").strip()
    term_val = (term or "").strip().upper()
    if not code or not name or not term_val:
        raise ValueError("Please provide the course code, name, and term.")

    existing = CourseRepository.filter(course_code__iexact=code, term__iexact=term_val)
    for item in existing:
        if item.id != course.id:
            raise ValueError("A course with this code already exists for the selected term.")

    def _parse_date(value: str | None, *, label: str) -> date:
        if not value:
            raise ValueError(f"Please provide the course {label}.")
        try:
            return datetime.fromisoformat(value).date()
        except Exception as exc:
            raise ValueError(f"{label} must follow YYYY-MM-DD format.") from exc

    start_dt = _parse_date(start_date, label="start date")
    end_dt = _parse_date(end_date, label="end date")
    if end_dt < start_dt:
        raise ValueError("Course end date must be on or after the start date.")

    course.course_code = code
    course.name = name
    course.term = term_val
    course.start_date = start_dt
    course.end_date = end_dt
    course.save(update_fields=["course_code", "name", "term", "start_date", "end_date", "updated_at"])

    return {
        "id": course.id,
        "name": course.name,
        "course_code": course.course_code,
        "term": course.term,
        "join_code": course.join_code,
        "start_date": course.start_date.isoformat(),
        "end_date": course.end_date.isoformat(),
    }
