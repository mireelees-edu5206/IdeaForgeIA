from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GeoCategory = Literal["all", "clothing", "food", "groceries", "services"]


class GeoPlace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    place_id: str
    display_name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    category: str | None = None
    place_type: str | None = None


class GeoBusiness(BaseModel):
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
    latitude: float
    longitude: float
    radius_m: int
    category: GeoCategory
    places: list[GeoBusiness]
    attribution: str = "© OpenStreetMap contributors"
    caveat: str = (
        "Los lugares del mapa proceden de OpenStreetMap; su presencia no confirma que sean "
        "competidores ni que el registro esté actualizado."
    )
