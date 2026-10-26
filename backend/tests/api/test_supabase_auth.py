import json
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.supabase_auth import SupabaseTokenVerifier
from tests.api.helpers import EMAIL, auth_header, register
from tests.conftest import fetch_scalar, make_settings, run_sql

SUPABASE_URL = "https://ideaforge-test.supabase.co"
SUPABASE_SECRET = "supabase-test-secret-" + "x" * 32


def make_token(email: str, subject: uuid.UUID | None = None, **claims: object) -> str:
    now = datetime.now(UTC)
    payload = {
        "iss": f"{SUPABASE_URL}/auth/v1",
        "aud": "authenticated",
        "sub": str(subject or uuid.uuid4()),
        "role": "authenticated",
        "email": email,
        "user_metadata": {"full_name": "Ana Pérez"},
        "iat": now,
        "exp": now + timedelta(minutes=5),
        **claims,
    }
    return jwt.encode(payload, SUPABASE_SECRET, algorithm="HS256")


class FakeAuthResponse:
    def __init__(self, user: dict) -> None:
        self.user = user

    def __enter__(self) -> "FakeAuthResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.user).encode()


def mock_supabase_user(app, auth_user: dict, monkeypatch: pytest.MonkeyPatch):
    settings = make_settings(
        supabase_url=SUPABASE_URL,
        supabase_publishable_key="test-publishable-key",
        supabase_jwt_secret=SUPABASE_SECRET,
    )
    verifier = SupabaseTokenVerifier(settings)
    response = {"user": auth_user}
    monkeypatch.setattr(
        "app.core.supabase_auth.urlopen",
        lambda _request, timeout: FakeAuthResponse(response["user"]),
    )
    app.state.supabase_jwt_verifier = verifier
    return lambda user: response.update(user=user)


def test_public_root_and_protected_profile(db_client: TestClient) -> None:
    assert db_client.get("/").status_code == 200
    missing = db_client.get("/api/v1/perfil")
    assert missing.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    assert db_client.get("/perfil").status_code == 401


def test_supabase_login_provisions_local_profile(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    subject = uuid.uuid4()
    email = "ana.supabase@example.com"
    auth_user = {
        "id": str(subject),
        "email": email,
        "email_confirmed_at": "2026-10-26T00:00:00Z",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "Ana Supabase"},
        "identities": [{"provider": "email"}],
    }
    mock_supabase_user(db_client.app, auth_user, monkeypatch)
    token = make_token(email, subject, user_metadata=auth_user["user_metadata"])

    response = db_client.get("/api/v1/perfil", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == email
    assert response.json()["full_name"] == "Ana Supabase"
    assert response.json()["role"] == "user"
    assert (
        fetch_scalar(
            migrated_db,
            "SELECT supabase_user_id FROM users WHERE email = :email",
            {"email": email},
        )
        == subject
    )


def test_supabase_login_links_existing_admin_and_keeps_role(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert register(db_client, email=EMAIL).status_code == 201
    run_sql(migrated_db, "UPDATE users SET role = 'admin' WHERE email = :email", {"email": EMAIL})
    subject = uuid.uuid4()
    auth_user = {
        "id": str(subject),
        "email": EMAIL,
        "email_confirmed_at": "2026-10-26T00:00:00Z",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "No reemplazar"},
        "identities": [{"provider": "email"}],
    }
    mock_supabase_user(db_client.app, auth_user, monkeypatch)
    token = make_token(EMAIL, subject, user_metadata=auth_user["user_metadata"])

    response = db_client.get("/api/v1/perfil", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert response.json()["full_name"] == "Ana Pérez"
    assert (
        fetch_scalar(
            migrated_db,
            "SELECT supabase_user_id FROM users WHERE email = :email",
            {"email": EMAIL},
        )
        == subject
    )


def test_unconfirmed_email_is_rejected_but_google_identity_is_allowed(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email = "pending@example.com"
    subject = uuid.uuid4()
    pending = {
        "id": str(subject),
        "email": email,
        "email_confirmed_at": None,
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "Pendiente"},
        "identities": [{"provider": "email"}],
    }
    set_user = mock_supabase_user(db_client.app, pending, monkeypatch)

    rejected = db_client.get("/api/v1/perfil", headers=auth_header(make_token(email, subject)))
    assert rejected.status_code == 403
    assert rejected.json()["error"]["code"] == "email_not_confirmed"

    google_id = uuid.uuid4()
    google_user = {
        **pending,
        "id": str(google_id),
        "email": "google@example.com",
        "app_metadata": {"provider": "google", "providers": ["google"]},
        "identities": [{"provider": "google"}],
    }
    set_user(google_user)
    accepted = db_client.get(
        "/api/v1/perfil", headers=auth_header(make_token("google@example.com", google_id))
    )

    assert accepted.status_code == 200
    assert accepted.json()["email"] == "google@example.com"


def test_bad_supabase_signature_is_rejected(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    subject = uuid.uuid4()
    token = jwt.encode(
        {
            "iss": f"{SUPABASE_URL}/auth/v1",
            "aud": "authenticated",
            "sub": str(subject),
            "role": "authenticated",
            "email": "ana@example.com",
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        "different-secret-" + "x" * 32,
        algorithm="HS256",
    )
    mock_supabase_user(
        db_client.app,
        {
            "id": str(subject),
            "email": "ana@example.com",
            "email_confirmed_at": "2026-10-26T00:00:00Z",
            "app_metadata": {"provider": "email"},
            "identities": [{"provider": "email"}],
        },
        monkeypatch,
    )

    response = db_client.get("/api/v1/perfil", headers=auth_header(token))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"
