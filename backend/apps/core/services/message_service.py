from __future__ import annotations

from typing import Iterable

from ..repositories.models import Message


def list_recent_messages(limit: int = 20) -> Iterable[Message]:
    """Return the most recent messages limited by `limit`."""
    return Message.objects.all()[:limit]


def create_message(*, content: str) -> Message:
    """Persist a new message with the given content."""
    return Message.objects.create(content=content)
