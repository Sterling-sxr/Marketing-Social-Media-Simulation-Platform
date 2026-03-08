"""
Profile repository helpers.
"""
from __future__ import annotations

from typing import Optional

from .base import BaseRepository
from .models import UserProfile


class ProfileRepository(BaseRepository[UserProfile]):
    """
    Data-access helpers for user profiles.

    Encapsulates profile-specific queries.
    """
    model = UserProfile
    
    @classmethod
    def get_by_user_id(cls, user_id: int) -> Optional[UserProfile]:
        """Fetch the profile for a given user."""
        return cls.model.objects.filter(user_id=user_id).first()
    
    @classmethod
    def user_has_profile(cls, user_id: int) -> bool:
        """Return whether the user has completed a profile."""
        return cls.exists(user_id=user_id)
    
    @classmethod
    def create_or_update(cls, user_id: int, profile_data: dict) -> tuple[UserProfile, bool]:
        """Create or update the profile for a user."""
        return cls.update_or_create(
            defaults=profile_data,
            user_id=user_id
        )


__all__ = ["ProfileRepository"]
