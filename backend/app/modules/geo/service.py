"""Aplica las reglas de las búsquedas geográficas y revisa los permisos. Area: geografia.

ARCHIVO: backend/app/modules/geo/service.py

¿Qué es?
La lógica de geografía. Limpia la búsqueda, verifica que el proyecto sea del usuario y delega
la consulta externa en el proveedor geográfico.

¿Para qué sirve?
Para que el router no conozca reglas de negocio ni la forma de consultar OpenStreetMap.

¿Quién lo usa?
`router.py` (cada endpoint de geografía llama a un método de `GeoService`).

Reglas principales:
- Una búsqueda de texto debe tener al menos 3 letras después de normalizar los espacios.
- Buscar lugares de un proyecto exige que el proyecto sea del usuario; si no, responde 404.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace
from app.modules.projects.service import get_owned_project
from app.modules.users.models import User


class GeoService:
    """Coordina las búsquedas geográficas: valida la entrada y delega en el proveedor."""

    def __init__(self, session: AsyncSession, provider: GeoProvider) -> None:
        """Guarda la sesión (para validar el proyecto) y el proveedor geográfico."""
        self.session = session
        self.provider = provider

    async def geocode(self, query: str) -> list[GeoPlace]:
        """Limpia los espacios de la búsqueda; si tiene menos de 3 letras devuelve lista vacía."""
        clean_query = " ".join(query.split())
        # Rama condicional: se cumple len(clean_query) < 3.
        if len(clean_query) < 3:
            return []
        return await self.provider.geocode(clean_query)

    async def nearby_places(
        self,
        user: User,
        project_id: uuid.UUID,
        latitude: float,
        longitude: float,
        radius_m: int,
        category: GeoCategory,
        keyword: str | None = None,
    ) -> list[GeoBusiness]:
        """Verifica que el proyecto sea del usuario (404 si no) y busca lugares en el proveedor."""
        await get_owned_project(self.session, user, project_id)
        clean_keyword = " ".join((keyword or "").split()).strip() or None
        return await self.provider.find_places(
            latitude, longitude, radius_m, category, clean_keyword
        )
