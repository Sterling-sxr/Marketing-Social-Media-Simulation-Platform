"""
Course AI User Repository
"""
from __future__ import annotations

from typing import List, Optional

from django.db.models import Q

from .base import BaseRepository
from .models import CourseAIUser


class CourseAIUserRepository(BaseRepository[CourseAIUser]):
    """Data-access helpers for course AI users."""

    model = CourseAIUser

    @classmethod
    def _base_queryset(cls):
        return cls.model.objects.select_related(
            "identity",
            "identity__user",
        )

    @classmethod
    def list_for_course(cls, course_id: int) -> List[CourseAIUser]:
        return list(
            cls._base_queryset()
            .filter(course_id=course_id)
            .order_by("username")
        )

    @classmethod
    def get_for_course(cls, course_id: int, ai_user_id: int) -> Optional[CourseAIUser]:
        try:
            return cls._base_queryset().get(id=ai_user_id, course_id=course_id)
        except cls.model.DoesNotExist:
            return None

    @classmethod
    def exists_username(cls, *, course_id: int, username: str, exclude_id: int | None = None) -> bool:
        qs = cls.model.objects.filter(course_id=course_id, username__iexact=username)
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.exists()

    @classmethod
    def search(cls, course_id: int, keyword: str) -> List[CourseAIUser]:
        qs = cls._base_queryset().filter(course_id=course_id)
        if keyword:
            qs = qs.filter(
                Q(username__icontains=keyword)
                | Q(display_name__icontains=keyword)
                | Q(city__icontains=keyword)
            )
        return list(qs.order_by("username"))


__all__ = ["CourseAIUserRepository"]
