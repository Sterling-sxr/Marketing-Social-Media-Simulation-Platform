"""Module summary: Collect related domain logic and document the intended design boundaries."""
from __future__ import annotations

from typing import List, Tuple

from .base import BaseRepository
from .models import Notification


class NotificationRepository(BaseRepository[Notification]):
    """Class summary: NotificationRepository keeps related behavior together behind one clear interface."""
    model = Notification
    
    @classmethod
    def get_user_notifications(cls, recipient: str, limit: int = 50) -> Tuple[List[Notification], int]:
        """Execute the `get_user_notifications` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        queryset = cls.model.objects.filter(recipient=recipient)
        unread_count = queryset.filter(is_read=False).count()
        notifications = list(queryset[:limit])
        return notifications, unread_count
    
    @classmethod
    def mark_as_read(cls, recipient: str, notification_ids: List[int]) -> int:
        """Execute the `mark_as_read` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        if not notification_ids:
            return 0
        return cls.model.objects.filter(
            recipient=recipient,
            id__in=notification_ids
        ).update(is_read=True)
    
    @classmethod
    def get_unread_count(cls, recipient: str) -> int:
        """Execute the `get_unread_count` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return cls.count(recipient=recipient, is_read=False)


__all__ = ["NotificationRepository"]
