"""Password reset workflows using email verification codes."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from django.conf import settings

from ..clients.gmail import GmailNotConfiguredError, send_gmail_message
from ..repositories import get_by_email
from .verification_helpers import (
    EMAIL_REGEX,
    clear_state,
    clear_verified,
    get_code,
    is_throttled,
    is_verified,
    mark_verified,
    normalise_email,
    store_code,
)

logger = logging.getLogger(__name__)

PURPOSE = "password-reset"
MIN_PASSWORD_LENGTH = 8

_RESET_TEMPLATE = (
    "Hi there,\n\n"
    "You requested to reset your Donut platform password.\n"
    "Use this verification code within 5 minutes: {code}\n\n"
    "If this wasn't you, please ignore this email."
)


class PasswordResetError(Exception):
    """Base error for password reset failures."""


class PasswordResetCodeError(PasswordResetError):
    """Raised when the verification code is invalid or expired."""


class PasswordResetThrottleError(PasswordResetError):
    """Raised when requests are too frequent."""


@dataclass
class PasswordResetRequest:
    email: str
    code: str


def _send_reset_email(email: str, code: str) -> None:
    try:
        send_gmail_message(
            subject="Donut Password Reset Code",
            body=_RESET_TEMPLATE.format(code=code),
            recipient=email,
        )
    except GmailNotConfiguredError:
        logger.warning("Gmail not configured; password reset code for %s is %s", email, code)
    except Exception as exc:  # pragma: no cover
        logger.exception("Failed to send password reset email to %s", email)
        raise PasswordResetError("Failed to send verification code. Please try again later.") from exc


def request_password_reset(email: str) -> PasswordResetRequest:
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise PasswordResetError("Please use an email from a .edu.au domain.")

    user = get_by_email(normalised_email)
    if not user:
        raise PasswordResetError("This email is not registered.")

    if is_throttled(purpose=PURPOSE, email=normalised_email):
        raise PasswordResetThrottleError("Verification code requested too frequently. Please wait before trying again.")

    # code = generate_code()
    code = "1234"  # Temporary fixed verification code for easier testing
    store_code(purpose=PURPOSE, email=normalised_email, code=code)
    # _send_reset_email(normalised_email, code)
    logger.info("TEST MODE: mock send password reset code %s to %s", code, normalised_email)

    return PasswordResetRequest(email=normalised_email, code=code if settings.DEBUG else "****")


def verify_password_reset_code(*, email: str, code: str) -> None:
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise PasswordResetError("Please use an email from a .edu.au domain.")

    user = get_by_email(normalised_email)
    if not user:
        raise PasswordResetError("This email is not registered.")

    code = (code or "").strip()
    if len(code) != 4 or not code.isdigit():
        raise PasswordResetCodeError("Invalid verification code format.")

    cached_code = get_code(purpose=PURPOSE, email=normalised_email)
    if not cached_code:
        raise PasswordResetCodeError("The verification code has expired. Please request a new one.")
    if cached_code != code:
        raise PasswordResetCodeError("Incorrect verification code.")

    mark_verified(purpose=PURPOSE, email=normalised_email)
    clear_state(purpose=PURPOSE, email=normalised_email)


def confirm_password_reset(*, email: str, new_password: str):
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise PasswordResetError("Please use an email from a .edu.au domain.")

    user = get_by_email(normalised_email)
    if not user:
        raise PasswordResetError("This email is not registered.")

    if not is_verified(purpose=PURPOSE, email=normalised_email):
        raise PasswordResetCodeError("Please verify using the code first.")

    if len(new_password or "") < MIN_PASSWORD_LENGTH:
        raise PasswordResetError("Password must be at least 8 characters long.")

    user.set_password(new_password)
    user.save(update_fields=["password"])

    clear_verified(purpose=PURPOSE, email=normalised_email)
    return user


__all__ = [
    "PasswordResetError",
    "PasswordResetCodeError",
    "PasswordResetThrottleError",
    "PasswordResetRequest",
    "request_password_reset",
    "verify_password_reset_code",
    "confirm_password_reset",
]
