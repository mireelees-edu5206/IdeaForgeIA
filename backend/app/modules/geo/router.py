import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import CurrentUser, DbSession
from app.modules.geo.schemas import GeoCategory, GeoPlace, GeoPlacesResponse
from app.modules.geo.service import GeoService

router = APIRouter(tags=["geo"])


def get_geo_service(request: Request, db: DbSession) -> GeoService:
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
