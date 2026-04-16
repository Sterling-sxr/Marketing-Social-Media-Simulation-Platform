from __future__ import annotations

from django.core.files.uploadedfile import UploadedFile

from ..repositories.models import MediaAsset


def list_recent_assets(limit: int = 20):
    """Execute the `list_recent_assets` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    return MediaAsset.objects.all()[:limit]


def store_upload(upload: UploadedFile) -> MediaAsset:
    """Execute the `store_upload` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
    asset = MediaAsset(
        file=upload,
        original_name=upload.name,
        content_type=getattr(upload, "content_type", ""),
        size=upload.size,
    )
    asset.save()
    return asset
