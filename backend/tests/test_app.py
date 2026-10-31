"""Pruebas de comportamiento para app."""

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import ALLOWED_ORIGIN, make_settings


def test_health_ok(client: TestClient) -> None:
    """Prueba el escenario: health ok."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_security_headers_are_set_on_success_and_error_responses(client: TestClient) -> None:
    """Prueba el escenario: security encabezados are set on correcto and error responses."""
    # Itera response sobre (client.get(un valor), client.get(un valor)).
    for response in (client.get("/api/v1/health"), client.get("/api/v1/no-existe")):
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
        assert response.headers["cache-control"] == "no-store"


def test_health_db_unavailable_returns_503_without_details(client: TestClient) -> None:
    """Prueba el escenario: health db unavailable returns 503 without details."""
    response = client.get("/api/v1/health/db")
    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "service_unavailable",
            "message": "La base de datos no está disponible.",
        }
    }
    assert "127.0.0.1" not in response.text


def test_cors_allows_configured_origin(client: TestClient) -> None:
    """Prueba el escenario: cors allows configured procedencia."""
    response = client.options(
        "/api/v1/health",
        headers={"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    """Prueba el escenario: cors rejects desconocido procedencia."""
    response = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_docs_disabled_outside_development(client: TestClient) -> None:
    """Prueba el escenario: docs disabled outside desarrollo."""
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_docs_enabled_in_development() -> None:
    """Prueba el escenario: docs enabled in desarrollo."""
    app = create_app(make_settings(app_env="development"))
    # Abre y libera los recursos declarados en este bloque.
    with TestClient(app) as dev_client:
        assert dev_client.get("/openapi.json").status_code == 200
