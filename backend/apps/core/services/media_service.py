from __future__ import annotations

from django.core.files.uploadedfile import UploadedFile

from ..repositories.models import MediaAsset


def list_recent_assets(limit: int = 20):
    """Return recent media assets limited by `limit`."""
    return MediaAsset.objects.all()[:limit]


def store_upload(upload: UploadedFile) -> MediaAsset:
    """Persist an uploaded file as a MediaAsset instance."""
    asset = MediaAsset(
        file=upload,
        original_name=upload.name,
        content_type=getattr(upload, "content_type", ""),
        size=upload.size,
    )
    asset.save()
    return asset
