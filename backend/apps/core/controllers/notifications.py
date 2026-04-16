from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Class summary: NotificationConsumer groups related behavior in one place."""

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

    # Function summary: disconnect implements this backend behavior.
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Function summary: notification_message implements this backend behavior.
    async def notification_message(self, event):
        payload = event.get("payload", {})
        await self.send_json({"type": "notification", **payload})

    # Function summary: receive_json implements this backend behavior.
    async def receive_json(self, content, **kwargs):
        # Section summary: this block is described for easier reading.
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})
