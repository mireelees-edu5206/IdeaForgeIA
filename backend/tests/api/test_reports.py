from collections.abc import Sequence

from fastapi.testclient import TestClient

from app.modules.ai.errors import AIUnavailableError
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.types import AIMessage
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace
from app.modules.reports.generation import report_sections
from app.modules.reports.schemas import (
    BusinessVerdict,
    InvestmentEstimate,
    ReportDraft,
    ZoneRecommendation,
)
from tests.api.helpers import user_headers
from tests.api.test_analysis import analyze, researched
from tests.api.test_projects import BASE, add_attribute, confirm, create_project, fill_required
from tests.api.test_research import latest_run, research_client, start
from tests.conftest import fetch_scalar, run_sql


class ReportGeoProvider(GeoProvider):
    def __init__(self) -> None:
        self.geocoded: list[str] = []
        self.searches: list[tuple[float, float, int, GeoCategory, str | None]] = []

    async def geocode(self, query: str) -> list[GeoPlace]:
        self.geocoded.append(query)
        return [
            GeoPlace(
                place_id="osm:area-1",
                display_name="San Mateo, México",
                latitude=19.29,
                longitude=-99.65,
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
        self.searches.append((latitude, longitude, radius_m, category, keyword))
        return [
            GeoBusiness(
                osm_type="node",
                osm_id=55,
                osm_url="https://www.openstreetmap.org/node/55",
                name="Comercio cercano",
                latitude=latitude,
                longitude=longitude,
                category="shop",
                subtype="convenience",
                website=None,
            )
        ]


def test_report_requires_project_analysis(db_client: TestClient, migrated_db: str) -> None:
    headers = user_headers(db_client)
    project = create_project(db_client, headers, "Idea pendiente")

    response = db_client.post(f"{BASE}/{project['id']}/reports", headers=headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "project_not_analyzed"
    assert fetch_scalar(migrated_db, "SELECT count(*) FROM reports") == 0


def test_verdict_does_not_keep_unbacked_investment_or_unknown_map_references() -> None:
    draft = ReportDraft(
        executive_summary=BusinessVerdict(
            recommendation="worth_testing",
            confidence="high",
            summary="La idea parece tener potencial según la información proporcionada.",
            investment=InvestmentEstimate(
                minimum_mxn=50_000,
                maximum_mxn=100_000,
                basis="Estimación basada en un resultado general del mercado.",
                assumptions=["El costo puede variar según el local."],
                evidence_refs=["H1"],
            ),
            zones=[
                ZoneRecommendation(
                    name="San Mateo",
                    reason="La zona parece favorable para probar la propuesta.",
                    place_refs=["G9"],
                    caveat="Los datos del mapa están incompletos.",
                )
            ],
            missing_information=[],
            next_steps=["Validar la idea con clientes potenciales."],
        ),
        idea_overview="Resumen suficiente de una idea.",
        market="Resumen suficiente del mercado.",
        competition="Resumen suficiente de opciones actuales.",
        opportunities="Resumen suficiente de oportunidades.",
        risks="Resumen suficiente de riesgos.",
        hypotheses="Resumen suficiente de supuestos por comprobar.",
        missing_information="Resumen suficiente de información pendiente.",
        conclusions="Resumen suficiente de conclusiones y próximos pasos.",
    )
    context = {
        "findings": [
            {
                "ref": "H1",
                "category": "customers",
                "statement": "Hay interés de clientes.",
                "confidence": "medium",
                "review_status": "accepted",
                "evidence": [],
            }
        ],
        "sources": [],
        "geography": {
            "status": "places_found",
            "areas": [
                {
                    "query": "San Mateo",
                    "resolved_area": "San Mateo, México",
                    "radius_m": 1000,
                    "places": [
                        {
                            "ref": "G1",
                            "name": "Tienda",
                            "category": "shop",
                            "subtype": "convenience",
                            "osm_url": "https://www.openstreetmap.org/node/1",
                        }
                    ],
                }
            ],
        },
    }

    sections = report_sections(draft, context)
    final_verdict = sections[0][2]

    assert final_verdict is not None
    assert final_verdict["investment"] is None
    assert final_verdict["zones"] == []


def test_report_generates_versioned_sections_with_traceable_sources(
    db_client: TestClient, migrated_db: str
) -> None:
    headers = user_headers(db_client)
    project_id, run_id = researched(db_client, headers)
    assert analyze(db_client, headers, project_id, run_id).status_code == 202

    response = db_client.post(f"{BASE}/{project_id}/reports", headers=headers)
    assert response.status_code == 202
    assert response.json()["status"] == "generating"

    report_id = response.json()["id"]
    detail = db_client.get(f"{BASE}/{project_id}/reports/{report_id}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "completed"
    assert body["version"] == 1
    assert body["run_id"] == run_id
    assert body["ai_provider"] == "fake"
    assert body["sections"][0]["verdict"]["recommendation"] == "insufficient_information"
    assert body["sections"][0]["verdict"]["investment"] is None
    assert len(body["sections"]) == 10
    assert all(section["content"].startswith("[Simulado]") for section in body["sections"][:8])

    references = body["sections"][8]["content"]
    assert "https://example.com/simulado" in references
    assert "[H1]" in references
    assert "[E1]" in references
    assert "[S1]" in references
    assert (
        fetch_scalar(
            migrated_db,
            "SELECT count(*) FROM ai_api_logs WHERE operation = 'report_generation'"
            " AND status = 'success'",
        )
        == 1
    )

    second = db_client.post(f"{BASE}/{project_id}/reports", headers=headers)
    assert second.status_code == 202
    assert second.json()["version"] == 2
    listed = db_client.get(f"{BASE}/{project_id}/reports", headers=headers)
    assert [report["version"] for report in listed.json()] == [2, 1]
    assert listed.json()[0]["section_count"] == 10


class ReportFails(FakeProvider):
    async def generate_structured(self, messages: Sequence[AIMessage], schema):
        if schema is ReportDraft:
            raise AIUnavailableError()
        return await super().generate_structured(messages, schema)


def test_report_failure_is_saved_and_logged(migrated_db: str) -> None:
    with research_client(migrated_db, ReportFails()) as client:
        headers = user_headers(client)
        project_id, run_id = researched(client, headers)
        assert analyze(client, headers, project_id, run_id).status_code == 202

        created = client.post(f"{BASE}/{project_id}/reports", headers=headers)
        assert created.status_code == 202
        detail = client.get(f"{BASE}/{project_id}/reports/{created.json()['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["status"] == "failed"
        assert detail.json()["error_code"] == "ai_unavailable"

    assert (
        fetch_scalar(
            migrated_db,
            "SELECT error_code FROM ai_api_logs WHERE operation = 'report_generation'",
        )
        == "ai_unavailable"
    )
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_final_verdict_uses_confirmed_zones_and_current_map_places(migrated_db: str) -> None:
    geo_provider = ReportGeoProvider()
    with research_client(migrated_db, geo_provider=geo_provider) as client:
        headers = user_headers(client)
        project = create_project(client, headers, "Heladería local")
        fill_required(client, headers, project["id"])
        add_attribute(client, headers, project["id"], "geographic_scope", "San Mateo, México")
        assert confirm(client, headers, project["id"]).status_code == 200

        assert start(client, headers, project["id"]).status_code == 202
        run = latest_run(client, headers, project["id"])
        assert analyze(client, headers, project["id"], run["id"]).status_code == 202
        created = client.post(
            f"{BASE}/{project['id']}/reports",
            json={
                "geographic_scopes": [
                    {
                        "query": "San Mateo, México",
                        "latitude": 19.29,
                        "longitude": -99.65,
                        "radius_m": 800,
                        "keyword": "heladerías",
                    },
                    {"query": "Centro de Metepec, México"},
                ]
            },
            headers=headers,
        )
        assert created.status_code == 202
        detail = client.get(
            f"{BASE}/{project['id']}/reports/{created.json()['id']}",
            headers=headers,
        ).json()

    sources = detail["sections"][8]["content"]
    assert "[G1] Lugar registrado: Comercio cercano" in sources
    assert "[G2] Lugar registrado: Comercio cercano" in sources
    assert "https://www.openstreetmap.org/node/55" in sources
    assert geo_provider.geocoded == ["Centro de Metepec, México"]
    assert geo_provider.searches == [
        (19.29, -99.65, 800, "all", "heladerías"),
        (19.29, -99.65, 1000, "all", None),
    ]
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_report_is_hidden_from_other_users(db_client: TestClient) -> None:
    headers = user_headers(db_client)
    project_id, run_id = researched(db_client, headers)
    assert analyze(db_client, headers, project_id, run_id).status_code == 202
    created = db_client.post(f"{BASE}/{project_id}/reports", headers=headers)
    report_id = created.json()["id"]

    other_headers = user_headers(db_client, email="otra@ideaforge.dev")
    response = db_client.get(f"{BASE}/{project_id}/reports/{report_id}", headers=other_headers)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"
