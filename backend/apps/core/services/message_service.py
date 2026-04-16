from __future__ import annotations

from typing import Iterable

from ..repositories.models import Message


def list_recent_messages(limit: int = 20) -> Iterable[Message]:
    """Function note: list_recent_messages handles this backend operation."""
    return Message.objects.all()[:limit]


def create_message(*, content: str) -> Message:
    """Function note: create_message handles this backend operation."""
    return Message.objects.create(content=content)
