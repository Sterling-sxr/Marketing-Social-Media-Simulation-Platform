from __future__ import annotations

from typing import Iterable

from ..repositories.models import Message


def list_recent_messages(limit: int = 20) -> Iterable[Message]:
    """Execute the `list_recent_messages` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return Message.objects.all()[:limit]


def create_message(*, content: str) -> Message:
    """Execute the `create_message` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return Message.objects.create(content=content)
