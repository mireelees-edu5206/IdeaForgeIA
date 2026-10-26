import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.supabase_auth import SupabaseTokenError, SupabaseTokenVerifier
from tests.conftest import make_settings

SUPABASE_URL = "https://ideaforge-test.supabase.co"
SUPABASE_SECRET = "supabase-test-secret-" + "x" * 32


def token_payload(**changes: object) -> dict:
    now = datetime.now(UTC)
    return {
        "iss": f"{SUPABASE_URL}/auth/v1",
        "aud": "authenticated",
        "sub": str(uuid.uuid4()),
        "role": "authenticated",
        "email": "ana@example.com",
        "iat": now,
        "exp": now + timedelta(minutes=5),
        **changes,
    }


def test_legacy_hs256_token_is_verified() -> None:
    verifier = SupabaseTokenVerifier(
        make_settings(supabase_url=SUPABASE_URL, supabase_jwt_secret=SUPABASE_SECRET)
    )
    token = jwt.encode(token_payload(), SUPABASE_SECRET, algorithm="HS256")

    assert verifier.decode(token)["email"] == "ana@example.com"


def test_asymmetric_signing_key_uses_jwks_public_key(monkeypatch: pytest.MonkeyPatch) -> None:
    verifier = SupabaseTokenVerifier(make_settings(supabase_url=SUPABASE_URL))
    private_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(token_payload(), private_key, algorithm="ES256", headers={"kid": "test"})
    monkeypatch.setattr(
        verifier.jwks,
        "get_signing_key_from_jwt",
        Mock(return_value=SimpleNamespace(key=private_key.public_key())),
    )

    assert verifier.decode(token)["role"] == "authenticated"


@pytest.mark.parametrize("algorithm", ["none", "HS384"])
def test_unapproved_algorithm_is_rejected(algorithm: str) -> None:
    verifier = SupabaseTokenVerifier(
        make_settings(supabase_url=SUPABASE_URL, supabase_jwt_secret=SUPABASE_SECRET)
    )
    key = None if algorithm == "none" else SUPABASE_SECRET
    token = jwt.encode(token_payload(), key, algorithm=algorithm)

    with pytest.raises(SupabaseTokenError):
        verifier.decode(token)


def test_token_with_wrong_issuer_is_rejected() -> None:
    verifier = SupabaseTokenVerifier(
        make_settings(supabase_url=SUPABASE_URL, supabase_jwt_secret=SUPABASE_SECRET)
    )
    token = jwt.encode(
        token_payload(iss="https://other.supabase.co/auth/v1"),
        SUPABASE_SECRET,
        algorithm="HS256",
    )

    with pytest.raises(SupabaseTokenError):
        verifier.decode(token)
