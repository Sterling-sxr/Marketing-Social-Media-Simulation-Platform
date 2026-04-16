"""Module summary: Collect related domain logic and document the intended design boundaries."""
from __future__ import annotations

from typing import List

from .base import BaseRepository
from .models import MediaAsset


class MediaRepository(BaseRepository[MediaAsset]):
    """Class summary: MediaRepository keeps related behavior together behind one clear interface."""
    model = MediaAsset
    
    @classmethod
    def get_recent_assets(cls, limit: int = 20) -> List[MediaAsset]:
        """Execute the `get_recent_assets` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return list(
            cls.model.objects
            .order_by('-uploaded_at')[:limit]
        )
    
    @classmethod
    def get_by_ids(cls, asset_ids: List[int]) -> List[MediaAsset]:
        """Execute the `get_by_ids` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        return list(
            cls.model.objects.filter(id__in=asset_ids)
        )


__all__ = ["MediaRepository"]
