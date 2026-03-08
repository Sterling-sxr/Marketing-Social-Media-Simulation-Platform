from __future__ import annotations

from django.conf import settings

from ..repositories.models import MediaAsset, Message, Notification


def message_to_dict(message: Message) -> dict:
    return {
        "id": message.id,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    }


def asset_to_dict(asset: MediaAsset) -> dict:
    public_base = settings.PUBLIC_MEDIA_URL.rstrip("/")
    return {
        "id": asset.id,
        "original_name": asset.original_name,
        "content_type": asset.content_type,
        "size": asset.size,
        "uploaded_at": asset.uploaded_at.isoformat(),
        "path": asset.file.name,
        "storage_url": asset.file.url,
        "public_url": f"{public_base}/{asset.file.name}",
    }


def notification_to_dict(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "recipient": notification.recipient,
        "actor": notification.actor,
        "action": notification.action,
        "subject": notification.subject,
        "body": notification.body,
        "link": notification.link,
        "metadata": notification.metadata,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }


__all__ = ["message_to_dict", "asset_to_dict", "notification_to_dict"]
