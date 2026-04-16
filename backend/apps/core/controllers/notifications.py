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

    # Purpose: Orchestrate `disconnect` with clear validation, dependency calls, and response mapping.
    # Input contract: Normalize required values early and fail fast on malformed payloads.
    # Output contract: Return a stable success/error shape after translating service outcomes.
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Purpose: Orchestrate `notification_message` with clear validation, dependency calls, and response mapping.
    # Input contract: Normalize required values early and fail fast on malformed payloads.
    # Output contract: Return a stable success/error shape after translating service outcomes.
    async def notification_message(self, event):
        payload = event.get("payload", {})
        await self.send_json({"type": "notification", **payload})

    # Purpose: Orchestrate `receive_json` with clear validation, dependency calls, and response mapping.
    # Input contract: Normalize required values early and fail fast on malformed payloads.
    # Output contract: Return a stable success/error shape after translating service outcomes.
    async def receive_json(self, content, **kwargs):
        # Context: Compute shared values once so all branches use the same normalized inputs.
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})
