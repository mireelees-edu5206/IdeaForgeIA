"""Fixtures asíncronas para las pruebas de esquema. Area: pruebas.

ARCHIVO: backend/tests/db/conftest.py

¿Qué es?
- `engine`: motor asíncrono conectado a la base de prueba ya migrada.
- `conn`: una conexión por prueba, para escribir y consultar SQL directo.

¿Quién lo usa?
`tests/db/test_schema.py`.
"""

from collections.abc import AsyncIterator

import pytest
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine


@pytest.fixture
async def engine(migrated_db: str) -> AsyncIterator[AsyncEngine]:
    """Crea el motor asíncrono de la base de prueba ya migrada."""
    engine = create_async_engine(migrated_db, poolclass=pool.NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def conn(engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """Conexión dentro de una transacción que se revierte: cada test queda aislado."""
    # Abre y libera los recursos declarados en este bloque.
    async with engine.connect() as connection:
        transaction = await connection.begin()
        yield connection
        await transaction.rollback()
