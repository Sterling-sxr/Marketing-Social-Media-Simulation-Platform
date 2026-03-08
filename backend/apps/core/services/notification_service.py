from __future__ import annotations

from typing import Iterable

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from ..repositories.models import Notification
from ..utils.serializers import notification_to_dict


def list_notifications(*, recipient: str, limit: int = 50) -> tuple[list[Notification], int]:
    """Return notifications for a recipient and the unread count."""
    queryset = Notification.objects.filter(recipient=recipient)
    unread_count = queryset.filter(is_read=False).count()
    return list(queryset[:limit]), unread_count


def mark_as_read(*, recipient: str, ids: Iterable[int]) -> int:
    """Mark supplied notification ids as read for the recipient."""
    ids = list(ids)
    if not ids:
        return 0
    return Notification.objects.filter(recipient=recipient, id__in=ids).update(is_read=True)


def create_notification(
    *,
    recipient: str,
    actor: str,
    action: str,
    subject: str,
    body: str,
    link: str,
    metadata: dict | None = None,
) -> dict:
    """Create and broadcast a notification returning the payload."""
    notification = Notification.objects.create(
        recipient=recipient,
        actor=actor,
        action=action,
        subject=subject,
        body=body,
        link=link,
        metadata=metadata or {},
    )
    payload = notification_to_dict(notification)
    _broadcast_notification(recipient=recipient, payload=payload)
    return payload


def _broadcast_notification(*, recipient: str, payload: dict) -> None:
    import logging
    logger = logging.getLogger(__name__)
    
    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning("No channel layer configured for notifications")
        return
    
    group_name = f"notifications_{recipient}"
    logger.info(f"Broadcasting notification to group: {group_name}, payload: {payload}")
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notification_message",
            "payload": payload,
        },
    )
