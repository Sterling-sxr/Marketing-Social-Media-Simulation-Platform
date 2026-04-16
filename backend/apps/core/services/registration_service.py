"""Module summary: registration_service defines backend functionality with clear intent."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from django.conf import settings

from ..clients.gmail import GmailNotConfiguredError, send_gmail_message
from ..repositories import UserCreationResult, create_user, get_by_email, get_by_username
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

_VERIFICATION_TEMPLATE = (
    "Hi there,\n\n"
    "Your Donut platform verification code is: {code}\n"
    "It will expire in 5 minutes.\n\n"
    "If you did not request this, please ignore this email."
)

MIN_PASSWORD_LENGTH = 8
PURPOSE = "register"


class RegistrationError(Exception):
    """Class summary: RegistrationError groups related behavior in one place."""


class VerificationCodeError(RegistrationError):
    """Class summary: VerificationCodeError groups related behavior in one place."""


class EmailThrottleError(RegistrationError):
    """Class summary: EmailThrottleError groups related behavior in one place."""


@dataclass
class VerificationRequest:
    email: str
    code: str

def _send_code_email(email: str, code: str) -> None:
    try:
        send_gmail_message(
            subject="Donut Verification Code",
            body=_VERIFICATION_TEMPLATE.format(code=code),
            recipient=email,
        )
    except GmailNotConfiguredError:
        # Section summary: this block is described for easier reading.
        logger.warning("Gmail not configured; verification code for %s is %s", email, code)
    except Exception as exc:  # pragma: no cover - network path
        logger.exception("Failed to send verification email to %s", email)
        raise RegistrationError("Failed to send verification code. Please try again later.") from exc


def request_verification_code(email: str) -> VerificationRequest:
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise RegistrationError("Please use an email from a .edu.au domain.")

    # Section summary: this block is described for easier reading.
    zid = normalised_email.split("@", 1)[0]
    if get_by_email(normalised_email) or get_by_username(zid):
        raise RegistrationError("This email is already registered. Please sign in.")

    if is_throttled(purpose=PURPOSE, email=normalised_email):
        raise EmailThrottleError("Verification code requested too frequently. Please wait before trying again.")

    # Section summary: this block is described for easier reading.
    code = "1234"  # Inline explanation: this statement is clarified for maintainability.
    store_code(purpose=PURPOSE, email=normalised_email, code=code)
    # Section summary: this block is described for easier reading.
    logger.info("TEST MODE: mock send verification code %s to %s", code, normalised_email)

    return VerificationRequest(email=normalised_email, code=code if settings.DEBUG else "****")


def verify_registration_code(*, email: str, code: str) -> None:
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise RegistrationError("Please use an email from a .edu.au domain.")

    code = (code or "").strip()
    if len(code) != 4 or not code.isdigit():
        raise VerificationCodeError("Invalid verification code format.")

    cached_code = get_code(purpose=PURPOSE, email=normalised_email)
    if not cached_code:
        raise VerificationCodeError("The verification code has expired. Please request a new one.")
    if cached_code != code:
        raise VerificationCodeError("Incorrect verification code.")

    mark_verified(purpose=PURPOSE, email=normalised_email)
    clear_state(purpose=PURPOSE, email=normalised_email)


def complete_registration(*, email: str, password: str) -> UserCreationResult:
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise RegistrationError("Please use an email from a .edu.au domain.")

    if len(password or "") < MIN_PASSWORD_LENGTH:
        raise RegistrationError("Password must be at least 8 characters long.")

    if not is_verified(purpose=PURPOSE, email=normalised_email):
        raise VerificationCodeError("Please verify your email with the code first.")

    zid = normalised_email.split("@", 1)[0]

    if get_by_email(normalised_email):
        raise RegistrationError("This email is already registered. Please sign in.")
    if get_by_username(zid):
        raise RegistrationError("This user identifier is already registered. Please sign in.")

    result = create_user(username=zid, email=normalised_email, password=password)
    if not result.created:
        raise RegistrationError("This user identifier is already registered. Please sign in.")

    clear_verified(purpose=PURPOSE, email=normalised_email)

    return result


__all__ = [
    "EmailThrottleError",
    "RegistrationError",
    "VerificationCodeError",
    "VerificationRequest",
    "request_verification_code",
    "verify_registration_code",
    "complete_registration",
]
