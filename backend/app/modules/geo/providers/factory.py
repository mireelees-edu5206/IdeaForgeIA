"""Crea el proveedor geográfico indicado en la configuración. Area: geografia.

ARCHIVO: backend/app/modules/geo/providers/factory.py

¿Qué es?
La función `build_geo_provider`, que lee `GEO_PROVIDER` y devuelve el adaptador correspondiente.

¿Para qué sirve?
Para cambiar de proveedor editando solo la configuración, sin tocar el código de los servicios.

¿Quién lo usa?
`app/main.py`, que la llama al arrancar y guarda el resultado en `app.state.geo_provider`.
"""

from app.core.config import Settings
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.providers.openstreetmap import OpenStreetMapGeoProvider


def build_geo_provider(settings: Settings) -> GeoProvider:
    """Crea el proveedor de OpenStreetMap con las URLs y el User-Agent de la configuración."""
    # Rama condicional: se cumple settings.geo_provider == 'openstreetmap'.
    if settings.geo_provider == "openstreetmap":
        return OpenStreetMapGeoProvider(
            settings.geo_nominatim_url,
            settings.geo_overpass_url,
            settings.geo_user_agent,
        )
    raise ValueError("El proveedor geográfico no está disponible.")
