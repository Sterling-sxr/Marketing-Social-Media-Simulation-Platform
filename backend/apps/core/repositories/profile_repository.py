"""Module summary: this module groups related logic and clarifies design intent."""
from __future__ import annotations

from typing import Optional

from .base import BaseRepository
from .models import UserProfile


class ProfileRepository(BaseRepository[UserProfile]):
    """Class summary: ProfileRepository keeps related behavior together behind one clear interface."""
    model = UserProfile
    
    @classmethod
    def get_by_user_id(cls, user_id: int) -> Optional[UserProfile]:
        """Handle the `get_by_user_id` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.filter(user_id=user_id).first()
    
    @classmethod
    def user_has_profile(cls, user_id: int) -> bool:
        """Handle the `user_has_profile` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.exists(user_id=user_id)
    
    @classmethod
    def create_or_update(cls, user_id: int, profile_data: dict) -> tuple[UserProfile, bool]:
        """Handle the `create_or_update` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.update_or_create(
            defaults=profile_data,
            user_id=user_id
        )


__all__ = ["ProfileRepository"]
