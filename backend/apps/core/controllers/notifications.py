from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Class note: NotificationConsumer encapsulates related backend behavior."""

    async def connect(self):
        query = parse_qs(self.scope.get("query_string", b"").decode())
        user = (query.get("user") or ["guest"])[0].strip() or "guest"
        self.user = user
        self.group_name = f"notifications_{user}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_json(
            {
                "type": "welcome",
                "message": f"Connected to notifications for {user}.",
            }
        )

    # Function note: disconnect handles this controller action.
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Function note: notification_message handles this controller action.
    async def notification_message(self, event):
        payload = event.get("payload", {})
        await self.send_json({"type": "notification", **payload})

    # Function note: receive_json handles this controller action.
    async def receive_json(self, content, **kwargs):
        # Section note: explains the purpose of this backend block.
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})
