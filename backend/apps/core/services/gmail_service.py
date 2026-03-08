from __future__ import annotations

from django.conf import settings
from google_auth_oauthlib.flow import Flow

from ..clients.gmail import GmailNotConfiguredError, send_gmail_message

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def build_gmail_flow() -> Flow:
    required = [
        settings.GMAIL_CLIENT_ID,
        settings.GMAIL_CLIENT_SECRET,
        settings.GMAIL_REDIRECT_URI,
    ]
    if not all(required):
        raise GmailNotConfiguredError(
            "Missing Gmail OAuth configuration. Set GMAIL_CLIENT_ID, "
            "GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI in the environment."
        )

    client_config = {
        "web": {
            "client_id": settings.GMAIL_CLIENT_ID,
            "client_secret": settings.GMAIL_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GMAIL_REDIRECT_URI],
        }
    }

    flow = Flow.from_client_config(client_config, scopes=GMAIL_SCOPES)
    flow.redirect_uri = settings.GMAIL_REDIRECT_URI
    return flow


def send_demo_email(*, subject: str, body: str, recipient: str | None) -> dict:
    return send_gmail_message(subject=subject, body=body, recipient=recipient)


__all__ = ["build_gmail_flow", "send_demo_email", "GmailNotConfiguredError"]
