"""
User repository helpers.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from django.contrib.auth import get_user_model
from django.db.models import Q

from .base import BaseRepository

User = get_user_model()


class UserRepository(BaseRepository[User]):
    """
    Data-access helpers for user accounts.

    Encapsulates user-focused queries.
    """
    model = User
    
    @classmethod
    def get_by_email(cls, email: str) -> Optional[User]:
        """Look up a user by email (case-insensitive)."""
        return cls.model.objects.filter(email__iexact=email).first()
    
    @classmethod
    def get_by_username(cls, username: str) -> Optional[User]:
        """Look up a user by username (case-insensitive)."""
        return cls.model.objects.filter(username__iexact=username).first()
    
    @classmethod
    def create_user(cls, username: str, email: str, password: str) -> User:
        """Create a new user."""
        return cls.model.objects.create_user(
            username=username.lower(),
            email=email.lower(),
            password=password,
        )
    
    @classmethod
    def username_exists(cls, username: str, exclude_id: int = None) -> bool:
        """Check whether the username already exists."""
        queryset = cls.model.objects.filter(username=username)
        if exclude_id:
            queryset = queryset.exclude(id=exclude_id)
        return queryset.exists()
    
    @classmethod
    def find_by_usernames(cls, usernames: List[str]) -> Dict[str, int]:
        """Bulk look up usernames and return a username->id mapping."""
        users = cls.model.objects.filter(
            username__in=[u.lower() for u in usernames]
        )
        return {user.username: user.id for user in users}
    
    @classmethod
    def search_in_course(cls, course_id: int, query: str, limit: int = 10) -> List[User]:
        """
        Search users within a course (used for @mention suggestions).
        """
        return list(
            cls.model.objects
            .filter(course_memberships__course_id=course_id)
            .filter(
                Q(username__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(email__icontains=query)
            )
            .distinct()[:limit]
        )


__all__ = ["UserRepository"]
