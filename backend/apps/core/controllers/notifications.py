from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Class summary: NotificationConsumer keeps related behavior together behind one clear interface."""

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

    # Purpose: Handle the `disconnect` workflow and keep behavior predictable.
    # Details: Validate incoming data, call dependent services, and return a stable response.
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Purpose: Handle the `notification_message` workflow and keep behavior predictable.
    # Details: Validate incoming data, call dependent services, and return a stable response.
    async def notification_message(self, event):
        payload = event.get("payload", {})
        await self.send_json({"type": "notification", **payload})

    # Purpose: Handle the `receive_json` workflow and keep behavior predictable.
    # Details: Validate incoming data, call dependent services, and return a stable response.
    async def receive_json(self, content, **kwargs):
        # Context: This block prepares shared values used by the request branches below.
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})
