from apps.core.services.message_service import create_message, list_recent_messages


def test_create_and_list_messages(db):
    # Create two messages
    m1 = create_message(content="Hello")
    m2 = create_message(content="World")

    items = list(list_recent_messages(limit=10))
    # Newest first by created_at (ordering desc)
    assert items[0].id == m2.id
    assert items[1].id == m1.id
    assert items[0].content == "World"
    assert items[1].content == "Hello"

