from __future__ import annotations

from typing import Iterable

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from ..repositories.models import Notification
from ..utils.serializers import notification_to_dict


def _parse_optional_course_id(course_id: object) -> int | None:
    if course_id is None:
        return None
    try:
        # Accept numeric strings and ints.
        course_id_int = int(str(course_id).strip())
        return course_id_int
    except (TypeError, ValueError):
        return None


def list_notifications(
    *,
    recipient: str,
    limit: int = 50,
    course_id: object | None = None,
) -> tuple[list[Notification], int]:
    """Return notifications for a recipient and the unread count.

    If `course_id` is provided, only notifications whose metadata.course_id
    matches are returned.
    """
    parsed_course_id = _parse_optional_course_id(course_id)
    queryset = Notification.objects.filter(recipient=recipient)
    if parsed_course_id is not None:
        queryset = queryset.filter(metadata__course_id=parsed_course_id)
    unread_count = queryset.filter(is_read=False).count()
    return list(queryset[:limit]), unread_count


def mark_as_read(*, recipient: str, ids: Iterable[int], course_id: object | None = None) -> int:
    """Mark supplied notification ids as read for the recipient.

    If `course_id` is provided, only matching notifications for that course
    are marked.
    """
    ids = list(ids)
    if not ids:
        return 0
    parsed_course_id = _parse_optional_course_id(course_id)
    qs = Notification.objects.filter(recipient=recipient, id__in=ids)
    if parsed_course_id is not None:
        qs = qs.filter(metadata__course_id=parsed_course_id)
    return qs.update(is_read=True)


def mark_all_as_read(*, recipient: str, course_id: object | None = None) -> int:
    """
    Mark all notifications for the given recipient as read.

    Used by the "Mark all read" action in the UI so that the badge
    count truly drops to zero, not just for the first page of results.
    """
    parsed_course_id = _parse_optional_course_id(course_id)
    qs = Notification.objects.filter(recipient=recipient, is_read=False)
    if parsed_course_id is not None:
        qs = qs.filter(metadata__course_id=parsed_course_id)
    return qs.update(is_read=True)


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
