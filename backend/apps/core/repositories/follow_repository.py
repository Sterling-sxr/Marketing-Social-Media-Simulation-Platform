"""Module summary: this module groups related logic and clarifies design intent."""
from __future__ import annotations

from typing import Set

from .base import BaseRepository
from .models import UserFollow


class FollowRepository(BaseRepository[UserFollow]):
    """Class summary: FollowRepository keeps related behavior together behind one clear interface."""
    model = UserFollow
    
    @classmethod
    def get_following_count(cls, user_id: int) -> int:
        """Handle the `get_following_count` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.count(follower_id=user_id)
    
    @classmethod
    def get_followers_count(cls, user_id: int) -> int:
        """Handle the `get_followers_count` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.count(target_id=user_id)
    
    @classmethod
    def is_following(cls, follower_id: int, target_id: int) -> bool:
        """Handle the `is_following` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.exists(follower_id=follower_id, target_id=target_id)
    
    @classmethod
    def get_following_ids(cls, user_id: int) -> Set[int]:
        """Handle the `get_following_ids` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return set(
            cls.model.objects
            .filter(follower_id=user_id)
            .values_list('target_id', flat=True)
        )
    
    @classmethod
    def get_follower_ids(cls, user_id: int) -> Set[int]:
        """Handle the `get_follower_ids` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return set(
            cls.model.objects
            .filter(target_id=user_id)
            .values_list('follower_id', flat=True)
        )
    
    @classmethod
    def follow(cls, follower_id: int, target_id: int) -> tuple[UserFollow, bool]:
        """Handle the `follow` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.model.objects.get_or_create(
            follower_id=follower_id,
            target_id=target_id
        )
    
    @classmethod
    def unfollow(cls, follower_id: int, target_id: int) -> int:
        """Handle the `unfollow` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return cls.delete_by_filter(follower_id=follower_id, target_id=target_id)


__all__ = ["FollowRepository"]
