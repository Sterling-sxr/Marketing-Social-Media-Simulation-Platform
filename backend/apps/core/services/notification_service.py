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
        # Context: This block prepares shared values used by the request branches below.
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
    """Handle the `list_notifications` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    parsed_course_id = _parse_optional_course_id(course_id)
    queryset = Notification.objects.filter(recipient=recipient)
    if parsed_course_id is not None:
        queryset = queryset.filter(metadata__course_id=parsed_course_id)
    unread_count = queryset.filter(is_read=False).count()
    return list(queryset[:limit]), unread_count


def mark_as_read(*, recipient: str, ids: Iterable[int], course_id: object | None = None) -> int:
    """Handle the `mark_as_read` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
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
    """Handle the `mark_all_as_read` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
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
    """Handle the `create_notification` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
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
