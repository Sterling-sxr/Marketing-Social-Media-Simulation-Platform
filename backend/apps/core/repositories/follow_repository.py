"""Module note: follow_repository backend module."""
from __future__ import annotations

from typing import Set

from .base import BaseRepository
from .models import UserFollow


class FollowRepository(BaseRepository[UserFollow]):
    """Class note: FollowRepository encapsulates related backend behavior."""
    model = UserFollow
    
    @classmethod
    def get_following_count(cls, user_id: int) -> int:
        """Function note: get_following_count handles this backend operation."""
        return cls.count(follower_id=user_id)
    
    @classmethod
    def get_followers_count(cls, user_id: int) -> int:
        """Function note: get_followers_count handles this backend operation."""
        return cls.count(target_id=user_id)
    
    @classmethod
    def is_following(cls, follower_id: int, target_id: int) -> bool:
        """Function note: is_following handles this backend operation."""
        return cls.exists(follower_id=follower_id, target_id=target_id)
    
    @classmethod
    def get_following_ids(cls, user_id: int) -> Set[int]:
        """Function note: get_following_ids handles this backend operation."""
        return set(
            cls.model.objects
            .filter(follower_id=user_id)
            .values_list('target_id', flat=True)
        )
    
    @classmethod
    def get_follower_ids(cls, user_id: int) -> Set[int]:
        """Function note: get_follower_ids handles this backend operation."""
        return set(
            cls.model.objects
            .filter(target_id=user_id)
            .values_list('follower_id', flat=True)
        )
    
    @classmethod
    def follow(cls, follower_id: int, target_id: int) -> tuple[UserFollow, bool]:
        """Function note: follow handles this backend operation."""
        return cls.model.objects.get_or_create(
            follower_id=follower_id,
            target_id=target_id
        )
    
    @classmethod
    def unfollow(cls, follower_id: int, target_id: int) -> int:
        """Function note: unfollow handles this backend operation."""
        return cls.delete_by_filter(follower_id=follower_id, target_id=target_id)


__all__ = ["FollowRepository"]
