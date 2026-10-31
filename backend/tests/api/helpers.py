"""Pruebas de comportamiento para helpers."""

from fastapi.testclient import TestClient

EMAIL = "ana@ideaforge.dev"
PASSWORD = "clave-muy-segura"


def register(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    """Registra el flujo principal."""
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "  Ana Pérez  "},
    )


def login(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    """Gestiona acceso."""
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def auth_header(access_token: str) -> dict[str, str]:
    """Gestiona autenticacion header."""
    return {"Authorization": f"Bearer {access_token}"}


def registered_tokens(client: TestClient, email: str = EMAIL) -> dict:
    """Gestiona registered tokens."""
    assert register(client, email=email).status_code == 201
    response = login(client, email=email)
    assert response.status_code == 200
    return response.json()


def user_headers(client: TestClient, email: str = EMAIL) -> dict[str, str]:
    """Gestiona usuario encabezados."""
    return auth_header(registered_tokens(client, email)["access_token"])
