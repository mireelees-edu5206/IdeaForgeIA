"""Expone los endpoints de salud del servidor y de la base de datos. Area: aplicacion.

ARCHIVO: backend/app/api/v1/health.py

¿Qué es?
Dos endpoints públicos: `/health` indica que el proceso responde, y `/health/db` además comprueba
que PostgreSQL acepta una consulta sencilla.

¿Para qué sirve?
Para que un humano o una herramienta de monitoreo vean si el backend y su base de datos están vivos.

¿Quién lo usa?
Quien revise el estado del servidor (por ejemplo, desde el navegador o un monitor). Se monta en
`api/v1/router.py`.

Importante: el detalle del error de base de datos solo va al log. No se devuelve al cliente porque
puede contener el host o el usuario de la conexión.
"""

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import DbSession
from app.core.errors import ServiceUnavailableError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Respuesta de los endpoints de salud: siempre `{"status": "ok"}`."""

    status: Literal["ok"]


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Indica si el servidor está activo."""
    return HealthResponse(status="ok")


@router.get("/health/db", response_model=HealthResponse)
async def health_db(db: DbSession) -> HealthResponse:
    """Indica si el servidor puede conectarse a la base de datos."""
    # Protege la operacion y dirige sus errores a manejadores explicitos.
    try:
        await db.execute(text("SELECT 1"))
    # Maneja el error Exception sin detener el flujo esperado.
    except Exception as exc:
        # El detalle solo va al log: puede contener host o usuario de la BD.
        logger.warning("Base de datos no disponible: %s", type(exc).__name__)
        raise ServiceUnavailableError("La base de datos no está disponible.") from exc
    return HealthResponse(status="ok")
