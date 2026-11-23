"""Define los contratos de geografía con Pydantic. Area: geografia.

ARCHIVO: backend/app/modules/geo/schemas.py

¿Qué es?
Los modelos de lugar (`GeoPlace`), negocio de OpenStreetMap (`GeoBusiness`) y la respuesta de la
búsqueda de lugares (`GeoPlacesResponse`), más la lista cerrada de categorías (`GeoCategory`).

¿Para qué sirve?
Para que cada respuesta tenga la misma forma y para que las coordenadas fuera de rango se rechacen
antes de llegar al proveedor.

¿Quién lo usa?
`router.py`, `service.py`, `providers/openstreetmap.py` y `admin/lab/schemas.py`.

Importante: `GeoPlacesResponse` siempre incluye la atribución de OpenStreetMap y una advertencia: la
presencia de un lugar no confirma que sea competidor.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GeoCategory = Literal["all", "clothing", "food", "groceries", "services"]


class GeoPlace(BaseModel):
    """Lugar devuelto por la geocodificación: nombre completo, coordenadas, categoría y tipo."""

    model_config = ConfigDict(extra="forbid")

    place_id: str
    display_name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    category: str | None = None
    place_type: str | None = None


class GeoBusiness(BaseModel):
    """Negocio o lugar de OpenStreetMap, con su enlace al objeto original en el mapa."""

    model_config = ConfigDict(extra="forbid")

    osm_type: Literal["node", "way", "relation"]
    osm_id: int
    osm_url: str
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    category: str
    subtype: str | None = None
    website: str | None = None


class GeoPlacesResponse(BaseModel):
    """Resultado de la búsqueda de lugares, con atribución y advertencia sobre su uso."""

    latitude: float
    longitude: float
    radius_m: int
    category: GeoCategory
    keyword: str | None = None
    places: list[GeoBusiness]
    attribution: str = "© OpenStreetMap contributors"
    caveat: str = (
        "Los lugares del mapa proceden de OpenStreetMap; su presencia no confirma que sean "
        "competidores ni que el registro esté actualizado."
    )
