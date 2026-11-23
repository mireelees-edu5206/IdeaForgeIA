"""Expone los endpoints HTTP de geografía. Area: geografia.

ARCHIVO: backend/app/modules/geo/router.py

¿Qué es?
Dos endpoints autenticados:
- GET /api/v1/geo/geocode?q=...: búsqueda manual de una ubicación.
- GET /api/v1/projects/{project_id}/geo/places: lugares alrededor de una coordenada, para un
  proyecto del usuario.

¿Para qué sirve?
Para que el frontend busque ubicaciones y lugares solo cuando la persona lo pide.

¿Quién lo usa?
El frontend (mapa de competidores y búsqueda de ubicación). `api/v1/router.py` lo monta.

Importante: `q` debe tener entre 3 y 160 caracteres, el radio entre 100 y 5000 metros, y la
palabra clave hasta 80 caracteres.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import CurrentUser, DbSession
from app.modules.geo.schemas import GeoCategory, GeoPlace, GeoPlacesResponse
from app.modules.geo.service import GeoService

router = APIRouter(tags=["geo"])


def get_geo_service(request: Request, db: DbSession) -> GeoService:
    """Crea el servicio de geografía con la sesión de la petición y el proveedor de `app.state`."""
    return GeoService(db, request.app.state.geo_provider)


Service = Annotated[GeoService, Depends(get_geo_service)]
GeoQuery = Annotated[str, Query(min_length=3, max_length=160)]
KeywordQuery = Annotated[str | None, Query(max_length=80)]
Latitude = Annotated[float, Query(ge=-90, le=90)]
Longitude = Annotated[float, Query(ge=-180, le=180)]
Radius = Annotated[int, Query(ge=100, le=5000)]


@router.get("/geo/geocode", response_model=list[GeoPlace])
async def geocode(_: CurrentUser, service: Service, q: GeoQuery) -> list[GeoPlace]:
    """Búsqueda manual de lugares; no debe invocarse como autocompletado."""
    return await service.geocode(q)


@router.get("/projects/{project_id}/geo/places", response_model=GeoPlacesResponse)
async def nearby_places(
    project_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
    latitude: Latitude,
    longitude: Longitude,
    radius_m: Radius = 1000,
    category: GeoCategory = "all",
    keyword: KeywordQuery = None,
) -> GeoPlacesResponse:
    """Lista lugares de OpenStreetMap alrededor de una coordenada, dentro de un proyecto del
    usuario. Espacios repetidos en la palabra clave se limpian antes de buscar."""
    clean_keyword = " ".join((keyword or "").split()).strip() or None
    places = await service.nearby_places(
        user, project_id, latitude, longitude, radius_m, category, clean_keyword
    )
    return GeoPlacesResponse(
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        category=category,
        keyword=clean_keyword,
        places=places,
    )
