"""Pruebas de comportamiento para errors."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.errors import NotFoundError


class _Payload(BaseModel):
    """Representa payload."""

    name: str = Field(min_length=3)


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Crea un cliente HTTP para probar respuestas de error."""

    @app.post("/_test/validation")
    async def validation_route(payload: _Payload) -> dict[str, str]:
        """Gestiona validacion ruta."""
        return {"name": payload.name}

    @app.get("/_test/app-error")
    async def app_error_route() -> None:
        """Gestiona aplicacion error ruta."""
        raise NotFoundError()

    @app.get("/_test/crash")
    async def crash_route() -> None:
        """Gestiona crash ruta."""
        raise RuntimeError("secreto interno: postgres://user:pass@host")

    return TestClient(app, raise_server_exceptions=False)


def test_unknown_route_uses_uniform_format(client: TestClient) -> None:
    """Prueba el escenario: desconocido ruta uses uniform format."""
    response = client.get("/api/v1/no-existe")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "El recurso solicitado no existe."}
    }


def test_method_not_allowed(client: TestClient) -> None:
    """Prueba el escenario: method no allowed."""
    response = client.post("/api/v1/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"


def test_validation_error_hides_input(client: TestClient) -> None:
    """Prueba el escenario: validacion error hides entrada."""
    response = client.post("/_test/validation", json={"name": "zq"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"][0]["field"] == "name"
    assert "zq" not in response.text


def test_app_error_is_mapped(client: TestClient) -> None:
    """Prueba el escenario: aplicacion error is mapped."""
    response = client.get("/_test/app-error")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_unhandled_error_does_not_leak_details(client: TestClient) -> None:
    """Prueba el escenario: unhandled error does no leak details."""
    response = client.get("/_test/crash")
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "Ocurrió un error interno."}
    }
    assert "postgres" not in response.text
