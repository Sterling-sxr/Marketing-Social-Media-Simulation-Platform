from __future__ import annotations

from typing import Iterable

from ..repositories.models import Message


def list_recent_messages(limit: int = 20) -> Iterable[Message]:
    """Handle the `list_recent_messages` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    return Message.objects.all()[:limit]


def create_message(*, content: str) -> Message:
    """Handle the `create_message` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    return Message.objects.create(content=content)
