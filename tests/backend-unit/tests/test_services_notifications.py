from apps.core.services.notification_service import (
    create_notification,
    list_notifications,
    mark_as_read,
)


def test_notification_create_list_mark(db):
    payload = create_notification(
        recipient="alice",
        actor="bob",
        action="replied",
        subject="bob replied",
        body="hi",
        link="",
        metadata={"post_id": 1},
    )

    assert payload["recipient"] == "alice"
    assert payload["is_read"] is False

    items, unread = list_notifications(recipient="alice", limit=10)
    assert unread == 1
    assert len(items) == 1
    assert items[0].subject == "bob replied"

    updated = mark_as_read(recipient="alice", ids=[payload["id"]])
    assert updated == 1

    items2, unread2 = list_notifications(recipient="alice", limit=10)
    assert unread2 == 0

