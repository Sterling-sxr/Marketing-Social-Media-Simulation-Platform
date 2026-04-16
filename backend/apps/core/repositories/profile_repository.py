"""Module note: profile_repository backend module."""
from __future__ import annotations

from typing import Optional

from .base import BaseRepository
from .models import UserProfile


class ProfileRepository(BaseRepository[UserProfile]):
    """Class note: ProfileRepository encapsulates related backend behavior."""
    model = UserProfile
    
    @classmethod
    def get_by_user_id(cls, user_id: int) -> Optional[UserProfile]:
        """Function note: get_by_user_id handles this backend operation."""
        return cls.model.objects.filter(user_id=user_id).first()
    
    @classmethod
    def user_has_profile(cls, user_id: int) -> bool:
        """Function note: user_has_profile handles this backend operation."""
        return cls.exists(user_id=user_id)
    
    @classmethod
    def create_or_update(cls, user_id: int, profile_data: dict) -> tuple[UserProfile, bool]:
        """Function note: create_or_update handles this backend operation."""
        return cls.update_or_create(
            defaults=profile_data,
            user_id=user_id
        )


__all__ = ["ProfileRepository"]
