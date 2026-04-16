"""Module summary: media_repository defines backend functionality with clear intent."""
from __future__ import annotations

from typing import List

from .base import BaseRepository
from .models import MediaAsset


class MediaRepository(BaseRepository[MediaAsset]):
    """Class summary: MediaRepository groups related behavior in one place."""
    model = MediaAsset
    
    @classmethod
    def get_recent_assets(cls, limit: int = 20) -> List[MediaAsset]:
        """Function summary: get_recent_assets executes this unit of backend logic."""
        return list(
            cls.model.objects
            .order_by('-uploaded_at')[:limit]
        )
    
    @classmethod
    def get_by_ids(cls, asset_ids: List[int]) -> List[MediaAsset]:
        """Function summary: get_by_ids executes this unit of backend logic."""
        return list(
            cls.model.objects.filter(id__in=asset_ids)
        )


__all__ = ["MediaRepository"]
