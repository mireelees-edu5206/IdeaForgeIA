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
    status: Literal["ok"]


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/health/db", response_model=HealthResponse)
async def health_db(db: DbSession) -> HealthResponse:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        # El detalle solo va al log: puede contener host o usuario de la BD.
        logger.warning("Base de datos no disponible: %s", type(exc).__name__)
        raise ServiceUnavailableError("La base de datos no está disponible.") from exc
    return HealthResponse(status="ok")
