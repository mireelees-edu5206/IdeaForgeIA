"""Funciones auxiliares para crear cuentas, iniciar sesión y armar cabeceras en las pruebas
de la API. Area: pruebas.

ARCHIVO: backend/tests/api/helpers.py

¿Qué es?
- `register` y `login`: crean o inician la cuenta de prueba con correo y contraseña por defecto.
- `auth_header`: arma la cabecera `Authorization: Bearer ...`.
- `registered_tokens` y `user_headers`: registran e inician sesión, y devuelven tokens o cabeceras.

¿Quién lo usa?
Casi todas las pruebas de `tests/api/`.
"""

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
    """Inicia sesión con la cuenta de prueba y devuelve la respuesta HTTP."""
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def auth_header(access_token: str) -> dict[str, str]:
    """Arma la cabecera Authorization con el token de acceso."""
    return {"Authorization": f"Bearer {access_token}"}


def registered_tokens(client: TestClient, email: str = EMAIL) -> dict:
    """Registra la cuenta de prueba, inicia sesión y devuelve sus tokens."""
    assert register(client, email=email).status_code == 201
    response = login(client, email=email)
    assert response.status_code == 200
    return response.json()


def user_headers(client: TestClient, email: str = EMAIL) -> dict[str, str]:
    """Devuelve las cabeceras de autenticación de la cuenta de prueba."""
    return auth_header(registered_tokens(client, email)["access_token"])
