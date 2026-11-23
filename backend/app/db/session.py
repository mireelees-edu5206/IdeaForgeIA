"""Crea el motor asíncrono de PostgreSQL y la fábrica de sesiones. Area: aplicacion.

ARCHIVO: backend/app/db/session.py

¿Qué es?
Dos funciones de construcción: `build_engine` crea la conexión con PostgreSQL (asyncpg), y
`build_sessionmaker` crea la fábrica que entrega una sesión por petición.

¿Para qué sirve?
Para que la aplicación tenga una sola forma de abrir conexiones y sesiones, configurada en un lugar.

¿Quién lo usa?
`app/main.py` (crea ambos al arrancar) y `app/api/deps.py` (entrega la sesión a cada endpoint).
"""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def build_engine(database_url: str) -> AsyncEngine:
    """Crea el motor asíncrono. `pool_pre_ping` revisa cada conexión antes de usarla.
    Así no falla con conexiones que la base ya cerró."""
    return create_async_engine(database_url, pool_pre_ping=True)


def build_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Crea la fábrica de sesiones. `expire_on_commit=False` evita recargar objetos después de cada
    commit: en modo async esa recarga implícita fallaría."""
    return async_sessionmaker(engine, expire_on_commit=False)
