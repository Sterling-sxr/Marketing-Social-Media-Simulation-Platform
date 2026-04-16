from __future__ import annotations

from django.core.files.uploadedfile import UploadedFile

from ..repositories.models import MediaAsset


def list_recent_assets(limit: int = 20):
    """Function note: list_recent_assets handles this backend operation."""
    return MediaAsset.objects.all()[:limit]


def store_upload(upload: UploadedFile) -> MediaAsset:
    """Function note: store_upload handles this backend operation."""
    asset = MediaAsset(
        file=upload,
        original_name=upload.name,
        content_type=getattr(upload, "content_type", ""),
        size=upload.size,
    )
    asset.save()
    return asset
