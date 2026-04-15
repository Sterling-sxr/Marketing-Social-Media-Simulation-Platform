from __future__ import annotations

from typing import Dict, Iterable, Optional

from .base import BaseRepository
from .models import CourseProfile


class CourseProfileRepository(BaseRepository[CourseProfile]):
    """Data access helpers for per-course personas."""

    model = CourseProfile

    @classmethod
    def get_for_user_course(cls, user_id: int, course_id: int) -> Optional[CourseProfile]:
        return (
            cls.model.objects.filter(user_id=user_id, course_id=course_id)
            .order_by("-updated_at")
            .first()
        )

    @classmethod
    def create_or_update(
        cls, *, user_id: int, course_id: int, profile_data: dict
    ) -> tuple[CourseProfile, bool]:
        return cls.model.objects.update_or_create(
            user_id=user_id,
            course_id=course_id,
            defaults=profile_data,
        )

    @classmethod
    def completed_map_for_user(
        cls, user_id: int, course_ids: Iterable[int]
    ) -> Dict[int, bool]:
        rows = cls.model.objects.filter(user_id=user_id, course_id__in=list(course_ids)).values_list(
            "course_id", flat=True
        )
        return {course_id: True for course_id in rows}


__all__ = ["CourseProfileRepository"]
