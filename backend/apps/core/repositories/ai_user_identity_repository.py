"""
Repository helpers for CourseAIUserIdentity.
"""
from __future__ import annotations

from typing import Optional

from .base import BaseRepository
from .models import CourseAIUserIdentity


class CourseAIUserIdentityRepository(BaseRepository[CourseAIUserIdentity]):
    model = CourseAIUserIdentity

    @classmethod
    def get_by_ai_user(cls, ai_user_id: int) -> Optional[CourseAIUserIdentity]:
        try:
            return cls.model.objects.select_related("user", "ai_user").get(ai_user_id=ai_user_id)
        except cls.model.DoesNotExist:
            return None

    @classmethod
    def get_by_user_id(cls, user_id: int) -> Optional[CourseAIUserIdentity]:
        try:
            return cls.model.objects.select_related("user", "ai_user").get(user_id=user_id)
        except cls.model.DoesNotExist:
            return None


__all__ = ["CourseAIUserIdentityRepository"]
