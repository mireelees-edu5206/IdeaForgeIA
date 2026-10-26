from collections.abc import Iterator
from contextlib import contextmanager
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.geo.providers.base import GeoProvider
from app.modules.geo.schemas import GeoBusiness, GeoCategory, GeoPlace
from tests.api.helpers import user_headers
from tests.api.test_admin import admin_headers
from tests.api.test_projects import add_attribute, create_project
from tests.conftest import fetch_scalar, make_settings, run_sql


class LabGeoProvider(GeoProvider):
    async def geocode(self, query: str) -> list[GeoPlace]:
        return []

    async def find_places(
        self,
        latitude: float,
        longitude: float,
        radius_m: int,
        category: GeoCategory,
        keyword: str | None = None,
    ) -> list[GeoBusiness]:
        return [
            GeoBusiness(
                osm_type="node",
                osm_id=101,
                osm_url="https://www.openstreetmap.org/node/101",
                name="Negocio uno",
                latitude=latitude + 0.001,
                longitude=longitude,
                category="food",
            ),
            GeoBusiness(
                osm_type="node",
                osm_id=202,
                osm_url="https://www.openstreetmap.org/node/202",
                name="Negocio dos",
                latitude=latitude,
                longitude=longitude + 0.001,
                category="food",
            ),
        ]


@contextmanager
def lab_client(db_url: str) -> Iterator[TestClient]:
    app = create_app(make_settings(database_url=db_url), geo_provider=LabGeoProvider())
    with TestClient(app) as client:
        yield client


def test_admin_lab_endpoints_reject_standard_user(db_client: TestClient) -> None:
    headers = user_headers(db_client)
    project_id = str(uuid4())

    assert db_client.get("/api/v1/admin/lab/metrics", headers=headers).status_code == 403
    assert db_client.get("/api/v1/admin/lab/propositions", headers=headers).status_code == 403
    assert db_client.get("/api/v1/admin/lab/projects", headers=headers).status_code == 403
    assert (
        db_client.get(f"/api/v1/admin/lab/projects/{project_id}/trace", headers=headers).status_code
        == 403
    )
    assert (
        db_client.post(
            f"/api/v1/admin/lab/projects/{project_id}/trace/path",
            headers=headers,
            json={"algorithm": "bfs", "target_node_id": "x"},
        ).status_code
        == 403
    )
    assert (
        db_client.post(
            f"/api/v1/admin/lab/projects/{project_id}/places",
            headers=headers,
            json={"latitude": 19.29, "longitude": -99.65, "keyword": "café"},
        ).status_code
        == 403
    )
    assert (
        db_client.post(
            f"/api/v1/admin/lab/projects/{project_id}/route",
            headers=headers,
            json={
                "latitude": 19.29,
                "longitude": -99.65,
                "radius_m": 1000,
                "keyword": "café",
                "selected_place_ids": ["node:1", "node:2"],
            },
        ).status_code
        == 403
    )
    assert (
        db_client.post(
            f"/api/v1/admin/lab/projects/{project_id}/budget-plan",
            headers=headers,
            json={"budget": 100, "items": []},
        ).status_code
        == 403
    )
    assert (
        db_client.post(
            f"/api/v1/admin/lab/projects/{project_id}/schedule",
            headers=headers,
            json={"tasks": []},
        ).status_code
        == 403
    )


def test_admin_lab_metrics_and_propositions(db_client: TestClient, migrated_db: str) -> None:
    headers = admin_headers(db_client, migrated_db, email="lab-admin@ideaforge.dev")

    propositions = db_client.get("/api/v1/admin/lab/propositions", headers=headers)
    assert propositions.status_code == 200
    body = propositions.json()
    rules = {rule["id"]: rule for rule in body["rules"]}
    assert set(rules) == {
        "structure",
        "research_start",
        "analysis_start",
        "finding_extraction",
        "confidence_cap",
        "report_start",
    }
    assert len(rules["structure"]["rows"]) == 16
    assert sum(row["result"] for row in rules["structure"]["rows"]) == 1
    assert len(rules["research_start"]["rows"]) == 8
    assert sum(row["result"] for row in rules["research_start"]["rows"]) == 1
    assert len(rules["analysis_start"]["rows"]) == 16
    assert sum(row["result"] for row in rules["analysis_start"]["rows"]) == 1
    assert len(rules["finding_extraction"]["rows"]) == 4
    assert sum(row["result"] for row in rules["finding_extraction"]["rows"]) == 1
    assert len(rules["confidence_cap"]["rows"]) == 8
    assert sum(row["result"] for row in rules["confidence_cap"]["rows"]) == 1
    assert len(rules["report_start"]["rows"]) == 8
    assert sum(row["result"] for row in rules["report_start"]["rows"]) == 1
    assert len(body["peas"]) == 4

    metrics = db_client.get("/api/v1/admin/lab/metrics?days=7", headers=headers)
    assert metrics.status_code == 200
    assert metrics.json()["days"] == 7
    assert len(metrics.json()["points"]) == 7
    assert db_client.get("/api/v1/admin/lab/metrics?days=3", headers=headers).status_code == 422


def test_admin_lab_lists_projects_and_traces_real_graph(
    db_client: TestClient, migrated_db: str
) -> None:
    owner = user_headers(db_client, email="dueno@ideaforge.dev")
    project = create_project(db_client, owner, "Heladería local")
    assert (
        add_attribute(db_client, owner, project["id"], "problem", "Precios altos").status_code
        == 201
    )
    source_id = fetch_scalar(
        migrated_db,
        "INSERT INTO sources (project_id, url, canonical_url, domain, title)"
        " VALUES (:pid, 'https://mercado.example/helados',"
        " 'https://mercado.example/helados', 'mercado.example', 'Estudio de mercado')"
        " RETURNING id::text",
        {"pid": project["id"]},
    )
    evidence_id = fetch_scalar(
        migrated_db,
        "INSERT INTO evidence (project_id, source_id, evidence_kind, content)"
        " VALUES (:pid, :sid, 'source_excerpt', 'La demanda local creció.')"
        " RETURNING id::text",
        {"pid": project["id"], "sid": source_id},
    )
    headers = admin_headers(db_client, migrated_db, email="lab-trace@ideaforge.dev")

    projects = db_client.get("/api/v1/admin/lab/projects", headers=headers)
    assert projects.status_code == 200
    listed = next(p for p in projects.json()["projects"] if p["id"] == project["id"])
    assert listed["owner_name"] == "Ana Pérez"

    trace = db_client.get(f"/api/v1/admin/lab/projects/{project['id']}/trace", headers=headers)
    assert trace.status_code == 200
    graph = trace.json()
    assert graph["root_id"] == f"project:{project['id']}"
    attribute_nodes = [n for n in graph["nodes"] if n["kind"] == "attribute"]
    assert len(attribute_nodes) == 1
    evidence_nodes = [n for n in graph["nodes"] if n["id"] == f"evidence:{evidence_id}"]
    assert len(evidence_nodes) == 1
    assert evidence_nodes[0]["details"]["evidence_kind"] == "source_excerpt"

    path = db_client.post(
        f"/api/v1/admin/lab/projects/{project['id']}/trace/path",
        headers=headers,
        json={"algorithm": "bfs", "target_node_id": attribute_nodes[0]["id"]},
    )
    assert path.status_code == 200
    result = path.json()
    assert result["found"] is True
    assert result["path"][0]["id"] == graph["root_id"]
    assert result["path"][-1]["id"] == attribute_nodes[0]["id"]

    missing = db_client.post(
        f"/api/v1/admin/lab/projects/{project['id']}/trace/path",
        headers=headers,
        json={"algorithm": "dfs", "target_node_id": "finding:no-existe"},
    )
    assert missing.status_code == 200
    assert missing.json()["found"] is False

    unknown = db_client.get(f"/api/v1/admin/lab/projects/{uuid4()}/trace", headers=headers)
    assert unknown.status_code == 404


def test_admin_lab_places_and_route_use_real_geo_provider(migrated_db: str) -> None:
    with lab_client(migrated_db) as client:
        headers = admin_headers(client, migrated_db, email="lab-geo@ideaforge.dev")
        project = create_project(client, headers, "Ruta de campo")

        places = client.post(
            f"/api/v1/admin/lab/projects/{project['id']}/places",
            headers=headers,
            json={"latitude": 19.29, "longitude": -99.65, "radius_m": 1000, "keyword": "café"},
        )
        assert places.status_code == 200
        assert [p["name"] for p in places.json()["places"]] == ["Negocio uno", "Negocio dos"]

        route = client.post(
            f"/api/v1/admin/lab/projects/{project['id']}/route",
            headers=headers,
            json={
                "latitude": 19.29,
                "longitude": -99.65,
                "radius_m": 1000,
                "keyword": "café",
                "selected_place_ids": ["node:101", "node:202"],
                "algorithm": "exact",
            },
        )
        assert route.status_code == 200
        body = route.json()
        assert body["persisted"] is False
        assert len(body["stops"]) == 2
        assert body["total_distance_km"] == body["optimal_reference_km"]

        stale = client.post(
            f"/api/v1/admin/lab/projects/{project['id']}/route",
            headers=headers,
            json={
                "latitude": 19.29,
                "longitude": -99.65,
                "radius_m": 1000,
                "keyword": "café",
                "selected_place_ids": ["node:101", "node:999"],
                "algorithm": "exact",
            },
        )
        assert stale.status_code == 409
        assert stale.json()["error"]["code"] == "geo_places_changed"
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_admin_lab_budget_and_schedule_use_real_hypotheses(
    db_client: TestClient, migrated_db: str
) -> None:
    owner = user_headers(db_client, email="analista@ideaforge.dev")
    project = create_project(db_client, owner, "Validación de mercado")
    first = fetch_scalar(
        migrated_db,
        "INSERT INTO validation_hypotheses (project_id, statement, priority, origin)"
        " VALUES (:pid, 'Los vecinos pagan por el producto.', 'high', 'ai') RETURNING id::text",
        {"pid": project["id"]},
    )
    second = fetch_scalar(
        migrated_db,
        "INSERT INTO validation_hypotheses (project_id, statement, priority, origin)"
        " VALUES (:pid, 'El canal digital atrae clientes.', 'medium', 'ai') RETURNING id::text",
        {"pid": project["id"]},
    )
    headers = admin_headers(db_client, migrated_db, email="lab-plan@ideaforge.dev")

    budget = db_client.post(
        f"/api/v1/admin/lab/projects/{project['id']}/budget-plan",
        headers=headers,
        json={
            "budget": 500,
            "algorithm": "exact",
            "items": [
                {"hypothesis_id": first, "estimated_cost": 400, "expected_value": 80},
                {"hypothesis_id": second, "estimated_cost": 300, "expected_value": 50},
            ],
        },
    )
    assert budget.status_code == 200
    plan = budget.json()
    assert plan["persisted"] is False
    assert plan["total_cost"] <= 500
    assert [item["hypothesis_id"] for item in plan["selected"]] == [first]

    schedule = db_client.post(
        f"/api/v1/admin/lab/projects/{project['id']}/schedule",
        headers=headers,
        json={
            "capacity_per_shift": 1,
            "tasks": [
                {"hypothesis_id": first, "preferred_shift": "matutino"},
                {"hypothesis_id": second, "preferred_shift": "matutino"},
            ],
        },
    )
    assert schedule.status_code == 200
    assignments = schedule.json()
    assert assignments["persisted"] is False
    assert len(assignments["assignments"]) == 2
    assert {a["assigned_shift"] for a in assignments["assignments"]} <= {
        "matutino",
        "vespertino",
        "nocturno",
    }

    foreign = db_client.post(
        f"/api/v1/admin/lab/projects/{project['id']}/budget-plan",
        headers=headers,
        json={
            "budget": 100,
            "items": [
                {
                    "hypothesis_id": str(uuid4()),
                    "estimated_cost": 10,
                    "expected_value": 10,
                }
            ],
        },
    )
    assert foreign.status_code == 409
    assert foreign.json()["error"]["code"] == "lab_hypotheses_changed"
