"""Nominatim + Overpass con límites locales, caché y consultas explícitas del usuario."""

import asyncio
import json
import math
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.modules.geo.errors import GeoProviderUnavailableError
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace

_MAX_RESPONSE_BYTES = 6_000_000
_NOMINATIM_MIN_INTERVAL_S = 1.0
_OVERPASS_MIN_INTERVAL_S = 0.25
_GEOCODE_TTL_S = 3600.0
_PLACES_TTL_S = 300.0
_MAX_PLACES = 80
_CATEGORY_FILTERS: dict[GeoCategory, tuple[tuple[str, str | None], ...]] = {
    "all": (
        ("shop", None),
        ("amenity", "restaurant|cafe|fast_food|ice_cream|pharmacy|bank|clinic|marketplace"),
    ),
    "clothing": (("shop", "clothes|shoes|fashion"),),
    "food": (("amenity", "restaurant|cafe|fast_food|ice_cream|marketplace"),),
    "groceries": (("shop", "supermarket|convenience|greengrocer"),),
    "services": (("amenity", "bank|pharmacy|clinic|post_office"),),
}
# Diccionario español -> etiquetas OSM para búsquedas por giro ("heladería", "panadería", etc.)
_SPANISH_KEYWORD_TAGS: tuple[tuple[tuple[str, ...], tuple[tuple[str, str], ...]], ...] = (
    (
        ("helad", "nieve", "palet", "gelat"),
        (("amenity", "ice_cream"), ("shop", "ice_cream|confectionery|pastry")),
    ),
    (
        ("panad", "pastel", "repost", "bakery"),
        (("shop", "bakery|pastry|confectionery"), ("amenity", "cafe")),
    ),
    (
        ("cafe", "cafet", "coffee"),
        (("amenity", "cafe"), ("shop", "coffee|tea")),
    ),
    (
        ("restaur", "comida", "taquer", "taco", "pizz", "hamburg", "antoj"),
        (("amenity", "restaurant|fast_food|food_court"),),
    ),
    (
        ("bar", "cantina", "cerve", "pub"),
        (("amenity", "bar|pub|biergarten"),),
    ),
    (
        ("ropa", "boutique", "moda", "playera", "vestid", "sastr"),
        (("shop", "clothes|fashion|boutique|tailor"),),
    ),
    (
        ("zapat", "calzad", "tenis"),
        (("shop", "shoes"),),
    ),
    (
        ("farmac", "medic", "botica"),
        (("amenity", "pharmacy|clinic|doctors"), ("shop", "chemist|medical_supply")),
    ),
    (
        ("gimnas", "gym", "fitness", "deport"),
        (("leisure", "fitness_centre|sports_centre"), ("shop", "sports")),
    ),
    (
        ("supermerc", "abarrot", "tienda", "minisuper", "oxxo"),
        (("shop", "supermarket|convenience|general|greengrocer"),),
    ),
    (
        ("ferret", "tlapal", "herramient"),
        (("shop", "hardware|doityourself"),),
    ),
    (
        ("papeler", "librer", "libro"),
        (("shop", "stationery|books|copyshop"),),
    ),
    (
        ("estetic", "peluquer", "barber", "belleza", "salon", "spa"),
        (("shop", "hairdresser|beauty|cosmetics"),),
    ),
    (
        ("veterin", "mascot", "pet"),
        (("amenity", "veterinary"), ("shop", "pet|pet_grooming")),
    ),
    (
        ("hotel", "hosped", "hostal", "motel"),
        (("tourism", "hotel|hostel|guest_house|motel"),),
    ),
    (
        ("taller", "mecan", "llant", "auto", "refacc"),
        (("shop", "car_repair|car_parts|tyres|car"),),
    ),
    (
        ("flor", "florer"),
        (("shop", "florist"),),
    ),
    (
        ("joyer", "reloj"),
        (("shop", "jewelry|watches"),),
    ),
    (
        (" Lavand", "lavand", "tintorer"),
        (("shop", "laundry|dry_cleaning"),),
    ),
)


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
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
        category: GeoCategory,
        keyword: str | None = None,
    ) -> list[GeoBusiness]:
        clean_kw = _normalize_keyword(keyword)
        cache_key = f"{latitude:.4f}:{longitude:.4f}:{radius_m}:{category}:{clean_kw}"
        now = time.monotonic()
        cached = self._places_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        # Búsqueda instantánea por viewbox en Nominatim (igual que openstreetmap.org)
        if keyword and clean_kw:
            places = await self._find_places_nominatim(
                latitude, longitude, radius_m, keyword.strip(), clean_kw
            )
            if not places and _has_spanish_category_match(clean_kw):
                places = await self._find_places_overpass_safe(
                    latitude, longitude, radius_m, category, keyword, clean_kw
                )
            if len(self._places_cache) >= 256:
                self._places_cache.clear()
            self._places_cache[cache_key] = (time.monotonic() + _PLACES_TTL_S, places)
            return places

        places = await self._find_places_overpass_safe(
            latitude, longitude, radius_m, category, keyword, clean_kw
        )
        if len(self._places_cache) >= 256:
            self._places_cache.clear()
        self._places_cache[cache_key] = (time.monotonic() + _PLACES_TTL_S, places)
        return places

    async def _find_places_overpass_safe(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
        category: GeoCategory,
        keyword: str | None,
        clean_kw: str,
    ) -> list[GeoBusiness]:
        async with self._overpass_lock:
            now = time.monotonic()
            delay = _OVERPASS_MIN_INTERVAL_S - (now - self._last_overpass_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_overpass_request = time.monotonic()
        query = _overpass_query(latitude, longitude, radius_m, category, keyword)
        for endpoint in (
            self.overpass_url,
            "https://overpass.kumi.systems/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter",
        ):
            request = Request(
                endpoint,
                data=urlencode({"data": query}).encode(),
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method="POST",
            )
            try:
                payload = await asyncio.to_thread(_read_json, request, 10.0)
                if isinstance(payload, dict) and isinstance(payload.get("elements"), list):
                    return _parse_businesses(payload["elements"], clean_kw or category)
            except GeoProviderUnavailableError:
                continue
        if keyword and clean_kw:
            return []
        raise GeoProviderUnavailableError()

    async def _find_places_nominatim(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
        raw_keyword: str,
        clean_kw: str,
    ) -> list[GeoBusiness]:
        # Caja de búsqueda amplia (mínimo 2.5 km) para no perder resultados cercanos al borde
        effective_radius_m = max(radius_m, 2500)
        lat_delta = effective_radius_m / 111_320.0
        cos_lat = max(0.2, abs(math.cos(math.radians(latitude))))
        lon_delta = effective_radius_m / (111_320.0 * cos_lat)
        left = longitude - lon_delta
        right = longitude + lon_delta
        top = latitude + lat_delta
        bottom = latitude - lat_delta

        async with self._nominatim_lock:
            now = time.monotonic()
            delay = _NOMINATIM_MIN_INTERVAL_S - (now - self._last_nominatim_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_nominatim_request = time.monotonic()

        params = urlencode(
            {
                "q": raw_keyword,
                "format": "jsonv2",
                "limit": "40",
                "addressdetails": "1",
                "extratags": "1",
                "bounded": "1",
                "viewbox": f"{left:.6f},{top:.6f},{right:.6f},{bottom:.6f}",
            }
        )
        request = Request(
            f"{self.nominatim_url}/search?{params}",
            headers={
                "User-Agent": self.user_agent,
                "Accept": "application/json",
                "Accept-Language": "es-MX,es",
            },
        )
        try:
            payload = await asyncio.to_thread(_read_json, request, 8.0)
        except GeoProviderUnavailableError:
            return []
        if not isinstance(payload, list):
            return []

        results: list[GeoBusiness] = []
        seen: set[tuple[str, int]] = set()
        for item in payload:
            if not isinstance(item, dict):
                continue
            osm_type = item.get("osm_type")
            osm_id = item.get("osm_id")
            if osm_type not in {"node", "way", "relation"} or not isinstance(osm_id, int):
                continue
            key = (osm_type, osm_id)
            if key in seen:
                continue
            try:
                lat = float(item["lat"])
                lon = float(item["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if _haversine_m(latitude, longitude, lat, lon) > max(radius_m * 1.35, 1800):
                continue
            raw_name = str(item.get("name") or "").strip()
            display_name = str(item.get("display_name") or "").strip()
            name = raw_name or display_name.split(",")[0].strip() or raw_keyword
            extratags = item.get("extratags") if isinstance(item.get("extratags"), dict) else {}
            subtype = _optional_string(item.get("type") or item.get("category"))
            website = _safe_website(extratags.get("website") or extratags.get("contact:website"))
            results.append(
                GeoBusiness(
                    osm_type=osm_type,
                    osm_id=osm_id,
                    osm_url=f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
                    name=name[:200],
                    latitude=lat,
                    longitude=lon,
                    category=clean_kw,
                    subtype=subtype,
                    website=website,
                )
            )
            seen.add(key)
            if len(results) >= _MAX_PLACES:
                break
        return results


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _has_spanish_category_match(norm_keyword: str) -> bool:
    for stems, _ in _SPANISH_KEYWORD_TAGS:
        if any(stem.strip() in norm_keyword for stem in stems):
            return True
    return False


def _normalize_keyword(keyword: str | None) -> str:
    if not keyword:
        return ""
    stripped = "".join(
        ch
        for ch in unicodedata.normalize("NFD", keyword.strip().lower())
        if unicodedata.category(ch) != "Mn"
    )
    return re.sub(r"[^\w\s-]", "", stripped).strip()[:60]


def _keyword_selectors(latitude: float, longitude: float, radius_m: int, keyword: str) -> list[str]:
    norm = _normalize_keyword(keyword)
    if not norm:
        return []
    matched_tags: list[tuple[str, str]] = []
    for stems, tag_pairs in _SPANISH_KEYWORD_TAGS:
        if any(stem.strip() in norm for stem in stems):
            matched_tags.extend(tag_pairs)

    tokens = [re.escape(tok) for tok in norm.split() if len(tok) >= 2]
    stem_pattern = "|".join(
        re.escape(tok[:-1] if len(tok) > 5 and tok.endswith(("s", "a", "o", "e")) else tok)
        for tok in norm.split()
        if len(tok) >= 2
    )
    regex_pattern = stem_pattern or "|".join(tokens) or re.escape(norm)

    around = f"(around:{radius_m},{latitude:.6f},{longitude:.6f})"
    selectors: list[str] = []
    seen_tags: set[tuple[str, str]] = set()
    for key, value in matched_tags:
        if (key, value) in seen_tags:
            continue
        seen_tags.add((key, value))
        selectors.append(f'  nwr{around}["{key}"~"^({value})$"];')
    # Búsqueda ágil por nombre (y en shop/amenity si no es un giro del catálogo)
    selectors.append(f'  nwr{around}["name"~"({regex_pattern})",i];')
    if not matched_tags:
        selectors.append(f'  nwr{around}["shop"~"({regex_pattern})",i];')
        selectors.append(f'  nwr{around}["amenity"~"({regex_pattern})",i];')
    return selectors


def _overpass_query(
    latitude: float,
    longitude: float,
    radius_m: int,
    category: GeoCategory,
    keyword: str | None = None,
) -> str:
    if keyword and _normalize_keyword(keyword):
        selectors = _keyword_selectors(latitude, longitude, radius_m, keyword)
    else:
        selectors = []
        for key, value in _CATEGORY_FILTERS[category]:
            tag = f'["{key}"]' if value is None else f'["{key}"~"^({value})$"]'
            for element_type in ("node", "way", "relation"):
                selectors.append(
                    f"  {element_type}(around:{radius_m},{latitude:.6f},{longitude:.6f}){tag};"
                )
    return "[out:json][timeout:12];\n(\n" + "\n".join(selectors) + "\n);\nout center tags 60;"


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
