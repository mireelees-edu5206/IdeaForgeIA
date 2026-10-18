from app.core.config import Settings
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.providers.openstreetmap import OpenStreetMapGeoProvider


def build_geo_provider(settings: Settings) -> GeoProvider:
    if settings.geo_provider == "openstreetmap":
        return OpenStreetMapGeoProvider(
            settings.geo_nominatim_url,
            settings.geo_overpass_url,
            settings.geo_user_agent,
        )
    raise ValueError("El proveedor geográfico no está disponible.")
