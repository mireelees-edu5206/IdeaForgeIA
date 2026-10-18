import asyncio
import os
from collections.abc import Iterator
from pathlib import Path

import pytest

# Valores ficticios para que los tests unitarios nunca toquen una BD real (puerto 1: nada
# escucha). Deben definirse antes de importar app.main, que crea la app al importarse.
UNREACHABLE_DB_URL = "postgresql+asyncpg://test:test@127.0.0.1:1/unreachable"
TEST_SECRET_KEY = "test-secret-key-" + "x" * 32
os.environ.setdefault("DATABASE_URL", UNREACHABLE_DB_URL)
os.environ.setdefault("SECRET_KEY", TEST_SECRET_KEY)

from alembic.config import Config  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import make_url, pool, text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from alembic import command  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

ALLOWED_ORIGIN = "http://localhost:5173"
BACKEND_DIR = Path(__file__).resolve().parents[1]


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "test",
        "cors_origins": [ALLOWED_ORIGIN],
        "database_url": UNREACHABLE_DB_URL,
        "secret_key": TEST_SECRET_KEY,
        "ai_provider": "fake",
        "ai_fake_latency_ms": 0,
        "research_recover_on_startup": False,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# ─────────────── Base de datos de pruebas (TEST_DATABASE_URL) ───────────────
# La BD se vacía al terminar: por seguridad su nombre debe terminar en "_test".
# Si TEST_DATABASE_URL no está definida, los tests que la usan se omiten.


def _alembic_config(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["database_url"] = url
    config.attributes["configure_logger"] = False
    return config


def fetch_scalar(url: str, sql: str, params: dict | None = None) -> object:
    """Ejecuta SQL (preparación, limpieza o consulta) desde tests síncronos."""

    async def _run() -> object:
        engine = create_async_engine(url, poolclass=pool.NullPool)
        async with engine.begin() as conn:
            result = await conn.execute(text(sql), params or {})
            value = result.scalar() if result.returns_rows else None
        await engine.dispose()
        return value

    return asyncio.run(_run())


def run_sql(url: str, sql: str, params: dict | None = None) -> None:
    fetch_scalar(url, sql, params)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def test_db_url() -> str:
    secret = Settings().test_database_url
    if secret is None:
        pytest.skip("TEST_DATABASE_URL no definida: se omiten los tests de BD.")
    url = secret.get_secret_value()
    database = make_url(url).database or ""
    if not database.endswith("_test"):
        pytest.exit(f"TEST_DATABASE_URL debe apuntar a una BD '*_test' (recibido: {database!r}).")
    return url


@pytest.fixture(scope="session")
def migrated_db(test_db_url: str) -> Iterator[str]:
    config = _alembic_config(test_db_url)
    command.downgrade(config, "base")  # parte de una BD limpia aunque una ejecución previa falle
    command.upgrade(config, "head")
    yield test_db_url
    command.downgrade(config, "base")


@pytest.fixture
def db_app(migrated_db: str) -> Iterator[FastAPI]:
    """App conectada a la BD de pruebas; al terminar se vacían todos los datos."""
    yield create_app(make_settings(database_url=migrated_db))
    run_sql(migrated_db, "TRUNCATE users CASCADE")


@pytest.fixture
def db_client(db_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(db_app) as test_client:
        yield test_client
