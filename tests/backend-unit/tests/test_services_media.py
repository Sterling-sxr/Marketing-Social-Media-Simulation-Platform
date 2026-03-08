from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.services.media_service import list_recent_assets, store_upload


def test_store_upload_and_list(db):
    upload = SimpleUploadedFile("pic.png", b"abc", content_type="image/png")
    asset = store_upload(upload)

    assert asset.id is not None
    assert asset.original_name == "pic.png"
    assert asset.content_type == "image/png"
    assert asset.size == 3

    items = list(list_recent_assets(limit=10))
    assert items and items[0].id == asset.id

