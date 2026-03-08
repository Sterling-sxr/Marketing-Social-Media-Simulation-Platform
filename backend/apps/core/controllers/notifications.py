from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Simple consumer that streams notification payloads to a given user."""

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

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_message(self, event):
        payload = event.get("payload", {})
        await self.send_json({"type": "notification", **payload})

    async def receive_json(self, content, **kwargs):
        # Optional ping/pong support for the demo UI.
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})
