from apps.core.services.notification_service import (
    create_notification,
    list_notifications,
    mark_as_read,
    mark_all_as_read,
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

    items, unread, unread_by_course = list_notifications(recipient="alice", limit=10)
    assert unread == 1
    assert unread_by_course == {}
    assert len(items) == 1
    assert items[0].subject == "bob replied"

    updated = mark_as_read(recipient="alice", ids=[payload["id"]])
    assert updated == 1

    items2, unread2, unread_by_course2 = list_notifications(recipient="alice", limit=10)
    assert unread2 == 0
    assert unread_by_course2 == {}


def test_mark_all_as_read_marks_every_unread_notification(db):
    create_notification(
        recipient="alice",
        actor="bob",
        action="replied",
        subject="first",
        body="hi",
        link="",
        metadata={"post_id": 1},
    )
    create_notification(
        recipient="alice",
        actor="carol",
        action="liked",
        subject="second",
        body="hello",
        link="",
        metadata={"post_id": 2},
    )

    updated = mark_all_as_read(recipient="alice")
    assert updated == 2

    _items, unread, unread_by_course = list_notifications(recipient="alice", limit=10)
    assert unread == 0
    assert unread_by_course == {}
