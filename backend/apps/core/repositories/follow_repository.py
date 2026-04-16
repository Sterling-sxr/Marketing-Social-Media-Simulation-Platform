"""Module summary: follow_repository defines backend functionality with clear intent."""
from __future__ import annotations

from typing import Set

from .base import BaseRepository
from .models import UserFollow


class FollowRepository(BaseRepository[UserFollow]):
    """Class summary: FollowRepository groups related behavior in one place."""
    model = UserFollow
    
    @classmethod
    def get_following_count(cls, user_id: int) -> int:
        """Function summary: get_following_count executes this unit of backend logic."""
        return cls.count(follower_id=user_id)
    
    @classmethod
    def get_followers_count(cls, user_id: int) -> int:
        """Function summary: get_followers_count executes this unit of backend logic."""
        return cls.count(target_id=user_id)
    
    @classmethod
    def is_following(cls, follower_id: int, target_id: int) -> bool:
        """Function summary: is_following executes this unit of backend logic."""
        return cls.exists(follower_id=follower_id, target_id=target_id)
    
    @classmethod
    def get_following_ids(cls, user_id: int) -> Set[int]:
        """Function summary: get_following_ids executes this unit of backend logic."""
        return set(
            cls.model.objects
            .filter(follower_id=user_id)
            .values_list('target_id', flat=True)
        )
    
    @classmethod
    def get_follower_ids(cls, user_id: int) -> Set[int]:
        """Function summary: get_follower_ids executes this unit of backend logic."""
        return set(
            cls.model.objects
            .filter(target_id=user_id)
            .values_list('follower_id', flat=True)
        )
    
    @classmethod
    def follow(cls, follower_id: int, target_id: int) -> tuple[UserFollow, bool]:
        """Function summary: follow executes this unit of backend logic."""
        return cls.model.objects.get_or_create(
            follower_id=follower_id,
            target_id=target_id
        )
    
    @classmethod
    def unfollow(cls, follower_id: int, target_id: int) -> int:
        """Function summary: unfollow executes this unit of backend logic."""
        return cls.delete_by_filter(follower_id=follower_id, target_id=target_id)


__all__ = ["FollowRepository"]
