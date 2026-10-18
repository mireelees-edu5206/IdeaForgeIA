import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace
from app.modules.projects.service import get_owned_project
from app.modules.users.models import User


class GeoService:
    def __init__(self, session: AsyncSession, provider: GeoProvider) -> None:
        self.session = session
        self.provider = provider

    async def geocode(self, query: str) -> list[GeoPlace]:
        clean_query = " ".join(query.split())
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
    ) -> list[GeoBusiness]:
        await get_owned_project(self.session, user, project_id)
        return await self.provider.find_places(latitude, longitude, radius_m, category)
