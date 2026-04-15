"""
Media repository – data-access helpers for stored assets.
"""
from __future__ import annotations

from typing import List

from .base import BaseRepository
from .models import MediaAsset


class MediaRepository(BaseRepository[MediaAsset]):
    """
    Data-access layer for media assets.

    Encapsulates media-related queries.
    """
    model = MediaAsset
    
    @classmethod
    def get_recent_assets(cls, limit: int = 20) -> List[MediaAsset]:
        """Fetch the most recently uploaded media assets."""
        return list(
            cls.model.objects
            .order_by('-uploaded_at')[:limit]
        )
    
    @classmethod
    def get_by_ids(cls, asset_ids: List[int]) -> List[MediaAsset]:
        """Bulk fetch media assets by ID."""
        return list(
            cls.model.objects.filter(id__in=asset_ids)
        )


__all__ = ["MediaRepository"]
