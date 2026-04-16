"""Module note: notification_repository backend module."""
from __future__ import annotations

from typing import List, Tuple

from .base import BaseRepository
from .models import Notification


class NotificationRepository(BaseRepository[Notification]):
    """Class note: NotificationRepository encapsulates related backend behavior."""
    model = Notification
    
    @classmethod
    def get_user_notifications(cls, recipient: str, limit: int = 50) -> Tuple[List[Notification], int]:
        """Function note: get_user_notifications handles this backend operation."""
        queryset = cls.model.objects.filter(recipient=recipient)
        unread_count = queryset.filter(is_read=False).count()
        notifications = list(queryset[:limit])
        return notifications, unread_count
    
    @classmethod
    def mark_as_read(cls, recipient: str, notification_ids: List[int]) -> int:
        """Function note: mark_as_read handles this backend operation."""
        if not notification_ids:
            return 0
        return cls.model.objects.filter(
            recipient=recipient,
            id__in=notification_ids
        ).update(is_read=True)
    
    @classmethod
    def get_unread_count(cls, recipient: str) -> int:
        """Function note: get_unread_count handles this backend operation."""
        return cls.count(recipient=recipient, is_read=False)


__all__ = ["NotificationRepository"]
