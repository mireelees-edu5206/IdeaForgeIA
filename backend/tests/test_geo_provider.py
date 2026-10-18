import asyncio
import io
import json
from unittest.mock import patch
from urllib.parse import parse_qs

from app.modules.geo.providers.openstreetmap import OpenStreetMapGeoProvider


def test_nominatim_geocoding_sends_manual_query_and_parses_coordinates() -> None:
    response = io.BytesIO(
        json.dumps(
            [
                {
                    "place_id": 123,
                    "display_name": "Toluca, Estado de México, México",
                    "lat": "19.2925",
                    "lon": "-99.6569",
                    "category": "boundary",
                    "type": "administrative",
                }
            ]
        ).encode()
    )
    provider = OpenStreetMapGeoProvider(
        "https://nominatim.example", "https://overpass.example/api", "IdeaForgeAI/tests"
    )
    with patch(
        "app.modules.geo.providers.openstreetmap.urlopen", return_value=response
    ) as mocked_urlopen:
        places = asyncio.run(provider.geocode("Toluca México"))

    request = mocked_urlopen.call_args.args[0]
    assert request.full_url.startswith("https://nominatim.example/search?")
    assert request.get_header("User-agent") == "IdeaForgeAI/tests"
    assert places[0].place_id == "123"
    assert places[0].latitude == 19.2925
    assert places[0].longitude == -99.6569


def test_overpass_search_is_radius_and_category_limited() -> None:
    response = io.BytesIO(
        json.dumps(
            {
                "elements": [
                    {
                        "type": "way",
                        "id": 77,
                        "center": {"lat": 19.29, "lon": -99.65},
                        "tags": {"name": "Tienda de prueba", "shop": "clothes"},
                    }
                ]
            }
        ).encode()
    )
    provider = OpenStreetMapGeoProvider(
        "https://nominatim.example", "https://overpass.example/api", "IdeaForgeAI/tests"
    )
    with patch(
        "app.modules.geo.providers.openstreetmap.urlopen", return_value=response
    ) as mocked_urlopen:
        places = asyncio.run(provider.find_places(19.2925, -99.6569, 900, "clothing"))

    request = mocked_urlopen.call_args.args[0]
    query = parse_qs(request.data.decode())["data"][0]
    assert "around:900,19.292500,-99.656900" in query
    assert '["shop"~"^(clothes|shoes|fashion)$"]' in query
    assert places[0].name == "Tienda de prueba"
    assert places[0].osm_type == "way"
    assert places[0].osm_url == "https://www.openstreetmap.org/way/77"
    assert places[0].latitude == 19.29
