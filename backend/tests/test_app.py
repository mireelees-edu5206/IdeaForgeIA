from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import ALLOWED_ORIGIN, make_settings


def test_health_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_unavailable_returns_503_without_details(client: TestClient) -> None:
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
    response = client.options(
        "/api/v1/health",
        headers={"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_docs_disabled_outside_development(client: TestClient) -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_docs_enabled_in_development() -> None:
    app = create_app(make_settings(app_env="development"))
    with TestClient(app) as dev_client:
        assert dev_client.get("/openapi.json").status_code == 200
