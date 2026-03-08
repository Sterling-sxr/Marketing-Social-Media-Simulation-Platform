"""Utilities for sending email via the Gmail API."""
import base64
from email.mime.text import MIMEText
from typing import Optional

from django.conf import settings
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class GmailNotConfiguredError(RuntimeError):
    """Raised when the Gmail client configuration is incomplete."""


def _build_credentials() -> Credentials:
    if not all(
        [
            settings.GMAIL_CLIENT_ID,
            settings.GMAIL_CLIENT_SECRET,
            settings.GMAIL_REFRESH_TOKEN,
            settings.GMAIL_SENDER,
        ]
    ):
        raise GmailNotConfiguredError(
            "Gmail OAuth credentials are missing. Please set GMAIL_CLIENT_ID, "
            "GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and GMAIL_SENDER in the environment."
        )

    return Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        scopes=[
            "https://www.googleapis.com/auth/gmail.send",
        ],
    )


def send_gmail_message(
    *, subject: str, body: str, recipient: Optional[str] = None
) -> dict:
    """Send a plaintext email using the Gmail API.

    Args:
        subject: Email subject line.
        body: Plaintext body content.
        recipient: Optional override for the recipient. Falls back to
            settings.GMAIL_DEMO_RECIPIENT when omitted.

    Returns:
        The raw Gmail API response dict.
    """

    to_address = recipient or settings.GMAIL_DEMO_RECIPIENT
    if not to_address:
        raise GmailNotConfiguredError(
            "Recipient email missing. Supply `recipient` or set GMAIL_DEMO_RECIPIENT."
        )

    credentials = _build_credentials()
    service = build("gmail", "v1", credentials=credentials, cache_discovery=False)

    message = MIMEText(body, _subtype="plain", _charset="utf-8")
    message["to"] = to_address
    message["from"] = settings.GMAIL_SENDER
    message["subject"] = subject

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

    try:
        return (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw_message})
            .execute()
        )
    except HttpError as exc:  # pragma: no cover - network path
        raise RuntimeError(f"Gmail API error: {exc}") from exc
