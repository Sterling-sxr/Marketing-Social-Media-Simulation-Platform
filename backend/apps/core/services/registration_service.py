"""Business logic for student/teacher self-registration."""
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
    """Base error for registration failures."""


class VerificationCodeError(RegistrationError):
    """Raised when verification code is missing or invalid."""


class EmailThrottleError(RegistrationError):
    """Raised when verification requests are made too frequently."""


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
        # Fallback for local development without Gmail credentials.
        logger.warning("Gmail not configured; verification code for %s is %s", email, code)
    except Exception as exc:  # pragma: no cover - network path
        logger.exception("Failed to send verification email to %s", email)
        raise RegistrationError("Failed to send verification code. Please try again later.") from exc


def request_verification_code(email: str) -> VerificationRequest:
    normalised_email = normalise_email(email)
    if not EMAIL_REGEX.match(normalised_email):
        raise RegistrationError("Please use an email from a .edu.au domain.")

    # Fail fast if the email/zID already exists to avoid a useless flow
    zid = normalised_email.split("@", 1)[0]
    if get_by_email(normalised_email) or get_by_username(zid):
        raise RegistrationError("This email is already registered. Please sign in.")

    if is_throttled(purpose=PURPOSE, email=normalised_email):
        raise EmailThrottleError("Verification code requested too frequently. Please wait before trying again.")

    # code = generate_code()
    code = "1234"  # Temporary fixed verification code to simplify testing
    store_code(purpose=PURPOSE, email=normalised_email, code=code)
    # _send_code_email(normalised_email, code)
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
