"""Module summary: profile_repository defines backend functionality with clear intent."""
from __future__ import annotations

from typing import Optional

from .base import BaseRepository
from .models import UserProfile


class ProfileRepository(BaseRepository[UserProfile]):
    """Class summary: ProfileRepository groups related behavior in one place."""
    model = UserProfile
    
    @classmethod
    def get_by_user_id(cls, user_id: int) -> Optional[UserProfile]:
        """Function summary: get_by_user_id executes this unit of backend logic."""
        return cls.model.objects.filter(user_id=user_id).first()
    
    @classmethod
    def user_has_profile(cls, user_id: int) -> bool:
        """Function summary: user_has_profile executes this unit of backend logic."""
        return cls.exists(user_id=user_id)
    
    @classmethod
    def create_or_update(cls, user_id: int, profile_data: dict) -> tuple[UserProfile, bool]:
        """Function summary: create_or_update executes this unit of backend logic."""
        return cls.update_or_create(
            defaults=profile_data,
            user_id=user_id
        )


__all__ = ["ProfileRepository"]
