"""Nominatim + Overpass con límites locales, caché y consultas explícitas del usuario."""

import asyncio
import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.modules.geo.errors import GeoProviderUnavailableError
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace

_MAX_RESPONSE_BYTES = 6_000_000
_NOMINATIM_MIN_INTERVAL_S = 1.0
_OVERPASS_MIN_INTERVAL_S = 3.0
_GEOCODE_TTL_S = 3600.0
_PLACES_TTL_S = 300.0
_MAX_PLACES = 80
_CATEGORY_FILTERS: dict[GeoCategory, tuple[tuple[str, str | None], ...]] = {
    "all": (
        ("shop", None),
        ("amenity", "restaurant|cafe|fast_food|pharmacy|bank|clinic|marketplace"),
    ),
    "clothing": (("shop", "clothes|shoes|fashion"),),
    "food": (("amenity", "restaurant|cafe|fast_food|marketplace"),),
    "groceries": (("shop", "supermarket|convenience|greengrocer"),),
    "services": (("amenity", "bank|pharmacy|clinic|post_office"),),
}


def _read_json(request: Request, timeout: float = 18.0) -> object:
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(_MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        if exc.code in {403, 429, 509}:
            raise GeoProviderUnavailableError(
                "El proveedor de mapas limitó temporalmente las solicitudes."
            ) from None
        raise GeoProviderUnavailableError() from None
    except (TimeoutError, URLError, OSError):
        raise GeoProviderUnavailableError() from None
    if len(body) > _MAX_RESPONSE_BYTES:
        raise GeoProviderUnavailableError()
    try:
        return json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise GeoProviderUnavailableError() from None


class OpenStreetMapGeoProvider(GeoProvider):
    """Usa búsquedas manuales Nominatim y consultas acotadas a Overpass."""

    def __init__(
        self,
        nominatim_url: str,
        overpass_url: str,
        user_agent: str,
    ) -> None:
        self.nominatim_url = nominatim_url.rstrip("/")
        self.overpass_url = overpass_url
        self.user_agent = user_agent
        self._nominatim_lock = asyncio.Lock()
        self._overpass_lock = asyncio.Lock()
        self._last_nominatim_request = 0.0
        self._last_overpass_request = 0.0
        self._geocode_cache: dict[str, tuple[float, list[GeoPlace]]] = {}
        self._places_cache: dict[str, tuple[float, list[GeoBusiness]]] = {}

    async def geocode(self, query: str) -> list[GeoPlace]:
        normalized = " ".join(query.split()).casefold()
        now = time.monotonic()
        cached = self._geocode_cache.get(normalized)
        if cached and cached[0] > now:
            return cached[1]

        async with self._nominatim_lock:
            now = time.monotonic()
            cached = self._geocode_cache.get(normalized)
            if cached and cached[0] > now:
                return cached[1]
            delay = _NOMINATIM_MIN_INTERVAL_S - (now - self._last_nominatim_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_nominatim_request = time.monotonic()
            params = urlencode(
                {
                    "q": query,
                    "format": "jsonv2",
                    "limit": "5",
                    "addressdetails": "1",
                }
            )
            request = Request(
                f"{self.nominatim_url}/search?{params}",
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "application/json",
                    "Accept-Language": "es",
                },
            )
            payload = await asyncio.to_thread(_read_json, request)
            if not isinstance(payload, list):
                raise GeoProviderUnavailableError()

            places = []
            for item in payload[:5]:
                if not isinstance(item, dict):
                    continue
                try:
                    places.append(
                        GeoPlace(
                            place_id=str(item["place_id"]),
                            display_name=str(item["display_name"]),
                            latitude=float(item["lat"]),
                            longitude=float(item["lon"]),
                            category=_optional_string(item.get("category")),
                            place_type=_optional_string(item.get("type")),
                        )
                    )
                except (KeyError, TypeError, ValueError):
                    continue

            if len(self._geocode_cache) >= 256:
                self._geocode_cache.clear()
            self._geocode_cache[normalized] = (
                time.monotonic() + _GEOCODE_TTL_S,
                places,
            )
            return places

    async def find_places(
        self, latitude: float, longitude: float, radius_m: int, category: GeoCategory
    ) -> list[GeoBusiness]:
        cache_key = f"{latitude:.4f}:{longitude:.4f}:{radius_m}:{category}"
        now = time.monotonic()
        cached = self._places_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        async with self._overpass_lock:
            now = time.monotonic()
            cached = self._places_cache.get(cache_key)
            if cached and cached[0] > now:
                return cached[1]
            delay = _OVERPASS_MIN_INTERVAL_S - (now - self._last_overpass_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_overpass_request = time.monotonic()
            query = _overpass_query(latitude, longitude, radius_m, category)
            request = Request(
                self.overpass_url,
                data=urlencode({"data": query}).encode(),
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method="POST",
            )
            payload = await asyncio.to_thread(_read_json, request, 25.0)
            if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
                raise GeoProviderUnavailableError()
            places = _parse_businesses(payload["elements"], category)
            if len(self._places_cache) >= 256:
                self._places_cache.clear()
            self._places_cache[cache_key] = (time.monotonic() + _PLACES_TTL_S, places)
            return places


def _overpass_query(latitude: float, longitude: float, radius_m: int, category: GeoCategory) -> str:
    selectors = []
    for key, value in _CATEGORY_FILTERS[category]:
        tag = f'["{key}"]' if value is None else f'["{key}"~"^({value})$"]'
        for element_type in ("node", "way", "relation"):
            selectors.append(
                f"  {element_type}(around:{radius_m},{latitude:.6f},{longitude:.6f}){tag};"
            )
    return "[out:json][timeout:20];\n(\n" + "\n".join(selectors) + "\n);\nout center tags 80;"


def _parse_businesses(elements: list[object], category: GeoCategory) -> list[GeoBusiness]:
    places: list[GeoBusiness] = []
    seen: set[tuple[str, int]] = set()
    for element in elements:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags")
        if not isinstance(tags, dict) or not isinstance(tags.get("name"), str):
            continue
        osm_type = element.get("type")
        osm_id = element.get("id")
        if osm_type not in {"node", "way", "relation"} or not isinstance(osm_id, int):
            continue
        key = (osm_type, osm_id)
        if key in seen:
            continue
        coordinates = element.get("center", element)
        if not isinstance(coordinates, dict):
            continue
        try:
            latitude = float(coordinates["lat"])
            longitude = float(coordinates["lon"])
            places.append(
                GeoBusiness(
                    osm_type=osm_type,
                    osm_id=osm_id,
                    osm_url=f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
                    name=tags["name"].strip()[:200],
                    latitude=latitude,
                    longitude=longitude,
                    category=category,
                    subtype=_business_subtype(tags),
                    website=_safe_website(tags.get("website") or tags.get("contact:website")),
                )
            )
            seen.add(key)
        except (KeyError, TypeError, ValueError):
            continue
        if len(places) >= _MAX_PLACES:
            break
    return places


def _business_subtype(tags: dict) -> str | None:
    for key in ("shop", "amenity"):
        value = tags.get(key)
        if isinstance(value, str):
            return value[:80]
    return None


def _optional_string(value: object) -> str | None:
    return value[:200] if isinstance(value, str) else None


def _safe_website(value: object) -> str | None:
    if isinstance(value, str) and value.startswith(("https://", "http://")):
        return value[:1000]
    return None
