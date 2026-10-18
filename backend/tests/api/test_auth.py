from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import AdminUser
from tests.api.helpers import EMAIL, PASSWORD, auth_header, login, register, registered_tokens
from tests.conftest import fetch_scalar, run_sql

# ─────────────── Registro ───────────────


def test_register_creates_user_without_exposing_hash(db_client: TestClient) -> None:
    response = register(db_client, email="Ana@IdeaForge.dev")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == EMAIL
    assert body["full_name"] == "Ana Pérez"
    assert body["role"] == "user"
    assert "password" not in response.text and "hash" not in response.text


def test_register_stores_argon2id_hash(db_client: TestClient, migrated_db: str) -> None:
    register(db_client)
    stored = fetch_scalar(
        migrated_db, "SELECT password_hash FROM users WHERE email = :e", {"e": EMAIL}
    )
    assert isinstance(stored, str) and stored.startswith("$argon2id$")
    assert PASSWORD not in stored


def test_register_duplicate_email_case_insensitive(db_client: TestClient) -> None:
    register(db_client)
    response = register(db_client, email=EMAIL.upper())
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


def test_register_cannot_set_role(db_client: TestClient) -> None:
    response = db_client.post(
        "/api/v1/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "full_name": "Ana", "role": "admin"},
    )
    assert response.status_code == 422


def test_register_validation_messages_in_spanish(db_client: TestClient) -> None:
    response = db_client.post(
        "/api/v1/auth/register", json={"email": "no-es-email", "password": "corta"}
    )
    assert response.status_code == 422
    details = {d["field"]: d["message"] for d in response.json()["error"]["details"]}
    assert details == {
        "email": "El valor no es válido.",
        "password": "Debe tener al menos 8 caracteres.",
        "full_name": "Este campo es obligatorio.",
    }


# ─────────────── Login y acceso ───────────────


def test_login_and_access_protected_route(db_client: TestClient) -> None:
    tokens = registered_tokens(db_client)
    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] == 30 * 60
    me = db_client.get("/api/v1/users/me", headers=auth_header(tokens["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == EMAIL


def test_login_errors_do_not_reveal_whether_email_exists(db_client: TestClient) -> None:
    register(db_client)
    wrong_password = login(db_client, password="incorrecta")
    unknown_email = login(db_client, email="nadie@ideaforge.dev")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["error"]["code"] == "invalid_credentials"


def test_protected_route_requires_valid_token(db_client: TestClient) -> None:
    missing = db_client.get("/api/v1/users/me")
    assert missing.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    invalid = db_client.get("/api/v1/users/me", headers=auth_header("basura"))
    assert invalid.status_code == 401
    assert invalid.json()["error"]["code"] == "invalid_token"


def test_login_rate_limited_after_failures(db_client: TestClient) -> None:
    register(db_client)
    for _ in range(5):
        assert login(db_client, password="incorrecta").status_code == 401
    blocked = login(db_client)  # incluso con la contraseña correcta
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_inactive_user_cannot_login_or_use_tokens(db_client: TestClient, migrated_db: str) -> None:
    tokens = registered_tokens(db_client)
    run_sql(migrated_db, "UPDATE users SET is_active = false")
    assert login(db_client).json()["error"]["code"] == "account_disabled"
    me = db_client.get("/api/v1/users/me", headers=auth_header(tokens["access_token"]))
    assert me.status_code == 401
    refreshed = db_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 401


# ─────────────── Refresh y logout ───────────────


def test_refresh_rotates_tokens(db_client: TestClient) -> None:
    tokens = registered_tokens(db_client)
    response = db_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert response.status_code == 200
    new_tokens = response.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]
    me = db_client.get("/api/v1/users/me", headers=auth_header(new_tokens["access_token"]))
    assert me.status_code == 200


def test_refresh_token_reuse_revokes_all_sessions(db_client: TestClient) -> None:
    tokens = registered_tokens(db_client)
    rotated = db_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    ).json()
    # Alguien reutiliza el token viejo (p. ej. robado): se rechaza y se cierran las sesiones.
    reuse = db_client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401
    assert reuse.json()["error"]["code"] == "invalid_refresh_token"
    legit = db_client.post("/api/v1/auth/refresh", json={"refresh_token": rotated["refresh_token"]})
    assert legit.status_code == 401


def test_logout_revokes_refresh_token(db_client: TestClient) -> None:
    tokens = registered_tokens(db_client)
    body = {"refresh_token": tokens["refresh_token"]}
    assert db_client.post("/api/v1/auth/logout", json=body).status_code == 204
    assert db_client.post("/api/v1/auth/logout", json=body).status_code == 204  # idempotente
    assert db_client.post("/api/v1/auth/refresh", json=body).status_code == 401


def test_expired_refresh_token_rejected(db_client: TestClient, migrated_db: str) -> None:
    tokens = registered_tokens(db_client)
    run_sql(
        migrated_db,
        "UPDATE refresh_tokens SET created_at = now() - interval '9 days',"
        " expires_at = now() - interval '1 day'",
    )
    response = db_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert response.status_code == 401


# ─────────────── Perfil y contraseña ───────────────


def test_update_profile(db_client: TestClient) -> None:
    tokens = registered_tokens(db_client)
    response = db_client.patch(
        "/api/v1/users/me",
        json={"full_name": "  Ana María  "},
        headers=auth_header(tokens["access_token"]),
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Ana María"


def test_change_password_revokes_sessions(db_client: TestClient) -> None:
    tokens = registered_tokens(db_client)
    headers = auth_header(tokens["access_token"])
    wrong = db_client.put(
        "/api/v1/users/me/password",
        json={"current_password": "incorrecta", "new_password": "nueva-clave-segura"},
        headers=headers,
    )
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "invalid_current_password"

    ok = db_client.put(
        "/api/v1/users/me/password",
        json={"current_password": PASSWORD, "new_password": "nueva-clave-segura"},
        headers=headers,
    )
    assert ok.status_code == 204
    old_refresh = db_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert old_refresh.status_code == 401
    assert login(db_client).status_code == 401
    assert login(db_client, password="nueva-clave-segura").status_code == 200


# ─────────────── Roles ───────────────


def test_require_admin(db_app: FastAPI, migrated_db: str) -> None:
    @db_app.get("/_test/admin")
    async def admin_only(user: AdminUser) -> dict[str, str]:
        return {"role": user.role}

    with TestClient(db_app) as client:
        headers = auth_header(registered_tokens(client)["access_token"])
        assert client.get("/_test/admin", headers=headers).status_code == 403
        run_sql(migrated_db, "UPDATE users SET role = 'admin'")
        response = client.get("/_test/admin", headers=headers)
        assert response.status_code == 200
        assert response.json() == {"role": "admin"}
