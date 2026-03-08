import pytest

from apps.core.services.registration_service import (
    request_verification_code,
    verify_registration_code,
    complete_registration,
    VerificationCodeError,
    RegistrationError,
)
from apps.core.repositories import get_by_email


def test_registration_happy_path(db, settings):
    email = "tester@ad.unsw.edu.au"

    req = request_verification_code(email)
    # In test mode, code is fixed to 1234 and returned when DEBUG=True; otherwise masked
    assert req.email == email

    # Always verify with 4-digit numeric code (project uses 1234 during tests)
    verify_registration_code(email=email, code="1234")

    result = complete_registration(email=email, password="StrongPass1!")
    assert result.created is True
    assert result.user.email == email
    # Ensure user persisted
    assert get_by_email(email) is not None


def test_registration_rejects_non_edu_email(db):
    with pytest.raises(RegistrationError):
        request_verification_code("user@gmail.com")


def test_verify_code_format(db):
    email = "codecheck@ad.unsw.edu.au"
    request_verification_code(email)
    with pytest.raises(VerificationCodeError):
        verify_registration_code(email=email, code="12ab")

