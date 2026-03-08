from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile


def test_demo_messages_and_files(db):
    client = Client()

    # Messages list (empty)
    resp = client.get("/api/messages/")
    assert resp.status_code == 200
    assert resp.json().get("items") == []

    # Create message
    resp = client.post("/api/messages/", data={"content": "Hello"}, content_type="application/json")
    assert resp.status_code == 201
    msg_id = resp.json()["id"]
    assert msg_id

    # Files list (empty)
    resp = client.get("/api/messages/files/")
    assert resp.status_code == 200
    assert resp.json().get("items") == []

    # Upload file
    upload = SimpleUploadedFile("pic.png", b"abc", content_type="image/png")
    resp = client.post("/api/messages/files/", data={"file": upload})
    assert resp.status_code == 201
    body = resp.json()
    assert body["original_name"] == "pic.png"
    assert body["content_type"] == "image/png"

