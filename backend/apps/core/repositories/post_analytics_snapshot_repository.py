"""Repository for PostAnalyticsSnapshot."""
from __future__ import annotations

from typing import Iterable, Optional

from .base import BaseRepository
from .models import PostAnalyticsSnapshot


class PostAnalyticsSnapshotRepository(BaseRepository[PostAnalyticsSnapshot]):
    model = PostAnalyticsSnapshot

    @classmethod
    def get_by_post(cls, post_id: int) -> Optional[PostAnalyticsSnapshot]:
        try:
            return cls.model.objects.select_related("post", "course").get(post_id=post_id)
        except cls.model.DoesNotExist:
            return None

    @classmethod
    def get_many_by_posts(cls, post_ids: Iterable[int]):
        return list(
            cls.model.objects.select_related("post", "course").filter(post_id__in=list(post_ids))
        )

