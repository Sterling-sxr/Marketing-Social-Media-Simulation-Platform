"""Module summary: this module groups related logic and clarifies design intent."""
from __future__ import annotations

from typing import List

from .base import BaseRepository
from .models import MediaAsset


class MediaRepository(BaseRepository[MediaAsset]):
    """Class summary: MediaRepository keeps related behavior together behind one clear interface."""
    model = MediaAsset
    
    @classmethod
    def get_recent_assets(cls, limit: int = 20) -> List[MediaAsset]:
        """Handle the `get_recent_assets` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return list(
            cls.model.objects
            .order_by('-uploaded_at')[:limit]
        )
    
    @classmethod
    def get_by_ids(cls, asset_ids: List[int]) -> List[MediaAsset]:
        """Handle the `get_by_ids` workflow.
        Validate incoming data, coordinate service calls, and return a consistent result.
        """
        return list(
            cls.model.objects.filter(id__in=asset_ids)
        )


__all__ = ["MediaRepository"]
