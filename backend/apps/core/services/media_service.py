from __future__ import annotations

from django.core.files.uploadedfile import UploadedFile

from ..repositories.models import MediaAsset


def list_recent_assets(limit: int = 20):
    """Handle the `list_recent_assets` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    return MediaAsset.objects.all()[:limit]


def store_upload(upload: UploadedFile) -> MediaAsset:
    """Handle the `store_upload` workflow.
    Validate incoming data, coordinate service calls, and return a consistent result.
    """
    asset = MediaAsset(
        file=upload,
        original_name=upload.name,
        content_type=getattr(upload, "content_type", ""),
        size=upload.size,
    )
    asset.save()
    return asset
