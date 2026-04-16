"""Module note: media_repository backend module."""
from __future__ import annotations

from typing import List

from .base import BaseRepository
from .models import MediaAsset


class MediaRepository(BaseRepository[MediaAsset]):
    """Class note: MediaRepository encapsulates related backend behavior."""
    model = MediaAsset
    
    @classmethod
    def get_recent_assets(cls, limit: int = 20) -> List[MediaAsset]:
        """Function note: get_recent_assets handles this backend operation."""
        return list(
            cls.model.objects
            .order_by('-uploaded_at')[:limit]
        )
    
    @classmethod
    def get_by_ids(cls, asset_ids: List[int]) -> List[MediaAsset]:
        """Function note: get_by_ids handles this backend operation."""
        return list(
            cls.model.objects.filter(id__in=asset_ids)
        )


__all__ = ["MediaRepository"]
