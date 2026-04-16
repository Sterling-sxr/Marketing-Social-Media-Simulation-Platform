"""
Follow repository helpers.
"""
from __future__ import annotations

from typing import Set

from .base import BaseRepository
from .models import UserFollow


class FollowRepository(BaseRepository[UserFollow]):
    """
    Data-access helpers for follow relationships.

    Encapsulates queries around user follow graphs.
    """
    model = UserFollow
    
    @classmethod
    def get_following_count(cls, user_id: int) -> int:
        """Return how many users this account follows."""
        return cls.count(follower_id=user_id)
    
    @classmethod
    def get_followers_count(cls, user_id: int) -> int:
        """Return follower count for the user."""
        return cls.count(target_id=user_id)
    
    @classmethod
    def is_following(cls, follower_id: int, target_id: int) -> bool:
        """Check whether follower already follows the target."""
        return cls.exists(follower_id=follower_id, target_id=target_id)
    
    @classmethod
    def get_following_ids(cls, user_id: int) -> Set[int]:
        """Return IDs the user is following."""
        return set(
            cls.model.objects
            .filter(follower_id=user_id)
            .values_list('target_id', flat=True)
        )
    
    @classmethod
    def get_follower_ids(cls, user_id: int) -> Set[int]:
        """Return IDs of users who follow this user."""
        return set(
            cls.model.objects
            .filter(target_id=user_id)
            .values_list('follower_id', flat=True)
        )
    
    @classmethod
    def follow(cls, follower_id: int, target_id: int) -> tuple[UserFollow, bool]:
        """Create a follow relationship."""
        return cls.model.objects.get_or_create(
            follower_id=follower_id,
            target_id=target_id
        )
    
    @classmethod
    def unfollow(cls, follower_id: int, target_id: int) -> int:
        """Remove a follow relationship."""
        return cls.delete_by_filter(follower_id=follower_id, target_id=target_id)


__all__ = ["FollowRepository"]
