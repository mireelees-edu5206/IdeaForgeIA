from collections.abc import Iterator
from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.ai.providers.fake import FakeProvider
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace
from tests.api.helpers import user_headers
from tests.api.test_projects import BASE, create_project
from tests.conftest import make_settings, run_sql


class StubGeoProvider(GeoProvider):
    def __init__(self) -> None:
        self.geocode_queries: list[str] = []
        self.nearby_requests: list[tuple[float, float, int, GeoCategory, str | None]] = []

    async def geocode(self, query: str) -> list[GeoPlace]:
        self.geocode_queries.append(query)
        return [
            GeoPlace(
                place_id="osm:1",
                display_name="Toluca, México",
                latitude=19.2925,
                longitude=-99.6569,
                category="boundary",
                place_type="administrative",
            )
        ]

    async def find_places(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
        category: GeoCategory,
        keyword: str | None = None,
    ) -> list[GeoBusiness]:
        self.nearby_requests.append((latitude, longitude, radius_m, category, keyword))
        return [
            GeoBusiness(
                osm_type="node",
                osm_id=42,
                osm_url="https://www.openstreetmap.org/node/42",
                name="Comercial de prueba",
                latitude=latitude,
                longitude=longitude,
                category=keyword or category,
                subtype="clothes",
                website="https://business.example",
            )
        ]


@contextmanager
def geo_client(db_url: str, provider: GeoProvider) -> Iterator[TestClient]:
    app = create_app(
        make_settings(database_url=db_url),
        ai_provider=FakeProvider(),
        geo_provider=provider,
    )
    with TestClient(app) as client:
        yield client


def test_manual_geocoding_is_authenticated_and_returns_normalized_places(migrated_db: str) -> None:
    provider = StubGeoProvider()
    with geo_client(migrated_db, provider) as client:
        headers = user_headers(client)

        response = client.get(
            "/api/v1/geo/geocode", params={"q": " Toluca   México "}, headers=headers
        )

        assert response.status_code == 200
        assert response.json()[0]["place_id"] == "osm:1"
        assert provider.geocode_queries == ["Toluca México"]

        unauthenticated = client.get("/api/v1/geo/geocode", params={"q": "Toluca"})
        assert unauthenticated.status_code == 401
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_nearby_places_are_scoped_to_owned_project_and_bounded(migrated_db: str) -> None:
    provider = StubGeoProvider()
    with geo_client(migrated_db, provider) as client:
        owner = user_headers(client)
        project = create_project(client, owner, "Marca local")
        params = {
            "latitude": "19.2925",
            "longitude": "-99.6569",
            "radius_m": "1200",
            "category": "clothing",
        }
        response = client.get(f"{BASE}/{project['id']}/geo/places", params=params, headers=owner)
        assert response.status_code == 200
        assert response.json()["attribution"] == "© OpenStreetMap contributors"
        assert response.json()["places"][0]["name"] == "Comercial de prueba"
        assert "no confirma que sean competidores" in response.json()["caveat"]
        assert provider.nearby_requests == [(19.2925, -99.6569, 1200, "clothing", None)]

        stranger = user_headers(client, email="geo-otro@ideaforge.dev")
        hidden = client.get(f"{BASE}/{project['id']}/geo/places", params=params, headers=stranger)
        assert hidden.status_code == 404

        invalid_radius = client.get(
            f"{BASE}/{project['id']}/geo/places",
            params={**params, "radius_m": "25000"},
            headers=owner,
        )
        assert invalid_radius.status_code == 422
    run_sql(migrated_db, "TRUNCATE users CASCADE")
