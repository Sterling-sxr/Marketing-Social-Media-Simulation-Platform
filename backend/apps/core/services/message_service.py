from __future__ import annotations

from typing import Iterable

from ..repositories.models import Message


def list_recent_messages(limit: int = 20) -> Iterable[Message]:
    """Function summary: list_recent_messages executes this unit of backend logic."""
    return Message.objects.all()[:limit]


def create_message(*, content: str) -> Message:
    """Function summary: create_message executes this unit of backend logic."""
    return Message.objects.create(content=content)
