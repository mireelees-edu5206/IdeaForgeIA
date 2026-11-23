"""Configura Alembic para migrar el esquema en modo síncrono y asíncrono. Area: base de datos.

ARCHIVO: backend/alembic/env.py

¿Qué es?
El archivo que Alembic ejecuta antes de cada migración. Decide la URL de la base (la inyectada por
las pruebas o `DATABASE_URL`), carga el metadata de todos los modelos y ejecuta las migraciones en
modo asíncrono con asyncpg.

¿Para qué sirve?
Para que `alembic upgrade head` y `alembic revision --autogenerate` vean el mismo esquema que la
aplicación.

¿Quién lo usa?
Alembic (`uv run alembic ...`) y `tests/conftest.py`, que lo llama para migrar la base de prueba.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401  (registra todos los modelos en el metadata)
from alembic import context
from app.core.config import get_settings
from app.db.base import Base

config = context.config

# Los tests desactivan esto para no reconfigurar el logging de pytest.
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def get_url() -> str:
    """Selecciona la URL de base de datos inyectada o la configuracion normal."""
    # Los tests inyectan la URL de la BD de pruebas; si no, se usa DATABASE_URL.
    return config.attributes.get("database_url") or get_settings().database_url.get_secret_value()


def run_migrations_offline() -> None:
    """Ejecuta migrations offline en migracion."""
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    # Abre y libera los recursos declarados en este bloque.
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Ejecuta las migraciones sobre una conexión síncrona ya abierta."""
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    # Abre y libera los recursos declarados en este bloque.
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Ejecuta async migrations en migracion."""
    engine = create_async_engine(get_url(), poolclass=pool.NullPool)
    # Abre y libera los recursos declarados en este bloque.
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


# Rama condicional: se cumple context.is_offline_mode().
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
