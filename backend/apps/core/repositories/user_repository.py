"""Module summary: user_repository defines backend functionality with clear intent."""
from __future__ import annotations

from typing import Dict, List, Optional

from django.contrib.auth import get_user_model
from django.db.models import Q

from .base import BaseRepository

User = get_user_model()


class UserRepository(BaseRepository[User]):
    """Class summary: UserRepository groups related behavior in one place."""
    model = User
    
    @classmethod
    def get_by_email(cls, email: str) -> Optional[User]:
        """Function summary: get_by_email executes this unit of backend logic."""
        return cls.model.objects.filter(email__iexact=email).first()
    
    @classmethod
    def get_by_username(cls, username: str) -> Optional[User]:
        """Function summary: get_by_username executes this unit of backend logic."""
        return cls.model.objects.filter(username__iexact=username).first()
    
    @classmethod
    def create_user(cls, username: str, email: str, password: str) -> User:
        """Function summary: create_user executes this unit of backend logic."""
        return cls.model.objects.create_user(
            username=username.lower(),
            email=email.lower(),
            password=password,
        )
    
    @classmethod
    def username_exists(cls, username: str, exclude_id: int = None) -> bool:
        """Function summary: username_exists executes this unit of backend logic."""
        queryset = cls.model.objects.filter(username=username)
        if exclude_id:
            queryset = queryset.exclude(id=exclude_id)
        return queryset.exists()
    
    @classmethod
    def find_by_usernames(cls, usernames: List[str]) -> Dict[str, int]:
        """Function summary: find_by_usernames executes this unit of backend logic."""
        users = cls.model.objects.filter(
            username__in=[u.lower() for u in usernames]
        )
        return {user.username: user.id for user in users}
    
    @classmethod
    def search_in_course(cls, course_id: int, query: str, limit: int = 10) -> List[User]:
        """Function summary: search_in_course executes this unit of backend logic."""
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
