from collections.abc import Iterator, Sequence
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.ai.errors import AIRateLimitError, AIUnavailableError
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.types import AIMessage, CitationSpan, GroundedResult, GroundedSource
from tests.api.helpers import user_headers
from tests.api.test_projects import BASE, add_attribute, confirm, create_project, fill_required
from tests.conftest import fetch_scalar, make_settings, run_sql

ACTIVE_RUN_SQL = (
    "INSERT INTO research_runs (project_id, status, ai_provider, ai_model)"
    " VALUES (:p, 'running', 'fake', 'fake-1')"
)


@contextmanager
def research_client(
    db_url: str, provider: AIProvider | None = None, **settings: object
) -> Iterator[TestClient]:
    app = create_app(make_settings(database_url=db_url, **settings), ai_provider=provider)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def headers(db_client: TestClient) -> dict[str, str]:
    return user_headers(db_client)


def structured_project(client: TestClient, headers: dict) -> dict:
    project = create_project(client, headers)
    fill_required(client, headers, project["id"])
    assert confirm(client, headers, project["id"]).status_code == 200
    return project


def start(client: TestClient, headers: dict, project_id: str):
    return client.post(f"{BASE}/{project_id}/research-runs", headers=headers)


def latest_run(client: TestClient, headers: dict, project_id: str) -> dict:
    runs = client.get(f"{BASE}/{project_id}/research-runs", headers=headers).json()
    detail = client.get(f"{BASE}/{project_id}/research-runs/{runs[0]['id']}", headers=headers)
    assert detail.status_code == 200
    return detail.json()


def project_status(client: TestClient, headers: dict, project_id: str) -> str:
    return client.get(f"{BASE}/{project_id}", headers=headers).json()["status"]


# ─────────────── Flujo completo ───────────────


def test_research_requires_structured_project(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    response = start(db_client, headers, project["id"])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "project_not_structured"


def test_full_research_run_with_fake_provider(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    project = structured_project(db_client, headers)
    response = start(db_client, headers, project["id"])
    assert response.status_code == 202
    assert response.json()["status"] == "pending"
    assert response.json()["ai_provider"] == "fake"

    # TestClient ejecuta la tarea en segundo plano antes de devolver el control.
    run = latest_run(db_client, headers, project["id"])
    assert run["status"] == "completed"
    assert run["progress_pct"] == 100
    assert run["error_code"] is None
    assert run["started_at"] and run["finished_at"]
    assert project_status(db_client, headers, project["id"]) == "researching"

    queries = run["queries"]
    assert len(queries) == 6
    assert [q["position"] for q in queries] == list(range(6))
    for query in queries:
        assert query["status"] == "completed"
        assert query["response_text"].startswith("[Simulado]")
        assert query["executed_queries"]
        assert [s["was_cited"] for s in query["sources"]] == [True, True, False]
        assert len(query["evidence"]) == 2
        for evidence in query["evidence"]:
            text = query["response_text"][evidence["span_start"] : evidence["span_end"]]
            assert evidence["content"] == text

    # La fuente compartida se deduplica por URL canónica (sin utm_*): 1 + 2 por pregunta.
    sources = db_client.get(f"{BASE}/{project['id']}/sources", headers=headers).json()
    assert len(sources) == 13
    shared = sources[0]
    assert shared["domain"] == "example.com"
    assert shared["citation_count"] == 6
    assert shared["evidence_count"] == 6
    assert (
        fetch_scalar(migrated_db, "SELECT canonical_url FROM sources WHERE domain = 'example.com'")
        == "https://example.com/simulado/panorama"
    )

    # Consumo registrado: 1 planificación + 6 búsquedas + 1 extracción, sin errores.
    assert fetch_scalar(migrated_db, "SELECT count(*) FROM ai_api_logs") == 8
    assert (
        fetch_scalar(
            migrated_db,
            "SELECT count(*) FROM ai_api_logs WHERE status = 'success' AND provider = 'fake'"
            " AND research_run_id IS NOT NULL",
        )
        == 8
    )


def test_research_respects_max_questions(migrated_db: str) -> None:
    with research_client(migrated_db, research_max_questions=3) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        start(client, headers, project["id"])
        assert len(latest_run(client, headers, project["id"])["queries"]) == 3
    run_sql(migrated_db, "TRUNCATE users CASCADE")


# ─────────────── Reglas de estado ───────────────


def test_active_run_blocks_new_runs_and_edits(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    project = structured_project(db_client, headers)
    run_sql(migrated_db, ACTIVE_RUN_SQL, {"p": project["id"]})
    url = f"{BASE}/{project['id']}"

    response = start(db_client, headers, project["id"])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "research_in_progress"
    for blocked in (
        add_attribute(db_client, headers, project["id"], "channels", "Venta directa"),
        db_client.patch(
            url, json={"raw_idea": "Otra idea distinta y suficientemente larga"}, headers=headers
        ),
        db_client.delete(url, headers=headers),
    ):
        assert blocked.status_code == 409
        assert blocked.json()["error"]["code"] == "research_in_progress"
    # El título no afecta a la investigación.
    assert db_client.patch(url, json={"title": "Nuevo"}, headers=headers).status_code == 200
    assert fetch_scalar(migrated_db, "SELECT count(*) FROM idea_attributes") == 3


def test_edit_after_research_returns_to_draft_and_keeps_history(
    db_client: TestClient, headers: dict
) -> None:
    project = structured_project(db_client, headers)
    start(db_client, headers, project["id"])
    add_attribute(db_client, headers, project["id"], "channels", "Venta directa")
    assert project_status(db_client, headers, project["id"]) == "draft"
    assert start(db_client, headers, project["id"]).status_code == 409
    runs = db_client.get(f"{BASE}/{project['id']}/research-runs", headers=headers).json()
    assert [r["status"] for r in runs] == ["completed"]

    # Tras reconfirmar se puede investigar de nuevo; la más reciente va primero.
    confirm(db_client, headers, project["id"])
    assert start(db_client, headers, project["id"]).status_code == 202
    runs = db_client.get(f"{BASE}/{project['id']}/research-runs", headers=headers).json()
    assert len(runs) == 2


def test_daily_research_limit(migrated_db: str) -> None:
    with research_client(migrated_db, research_max_runs_per_day=1) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        assert start(client, headers, project["id"]).status_code == 202
        response = start(client, headers, project["id"])
        assert response.status_code == 429
        assert response.json()["error"]["code"] == "research_limit_reached"
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_interrupted_runs_are_recovered_on_startup(migrated_db: str) -> None:
    with research_client(migrated_db) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
    run_sql(migrated_db, ACTIVE_RUN_SQL, {"p": project["id"]})
    run_sql(migrated_db, "UPDATE projects SET status = 'researching'")

    with research_client(migrated_db, research_recover_on_startup=True) as client:
        run = latest_run(client, headers, project["id"])
        assert run["status"] == "interrupted"
        assert run["error_code"] == "interrupted"
        assert run["finished_at"] is not None
        assert project_status(client, headers, project["id"]) == "structured"
    run_sql(migrated_db, "TRUNCATE users CASCADE")


# ─────────────── Fallos del proveedor ───────────────


class PlanningFails(FakeProvider):
    async def generate_structured(self, messages, schema):
        raise AIUnavailableError("detalle interno del proveedor")


class SearchFails(FakeProvider):
    def __init__(self, fail_all: bool) -> None:
        super().__init__()
        self.fail_all = fail_all
        self.calls = 0

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        self.calls += 1
        if self.fail_all or self.calls == 1:
            raise AIRateLimitError()
        return await super().generate_grounded(messages)


def test_planning_failure_marks_run_failed(migrated_db: str) -> None:
    with research_client(migrated_db, PlanningFails()) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        start(client, headers, project["id"])
        run = latest_run(client, headers, project["id"])
        assert run["status"] == "failed"
        assert run["error_code"] == "ai_unavailable"
        assert run["error_message"] == "El proveedor de IA no está disponible en este momento."
        assert "interno" not in run["error_message"]
        assert run["queries"] == []
        # La idea sigue estructurada: se puede reintentar.
        assert project_status(client, headers, project["id"]) == "structured"
    assert (
        fetch_scalar(migrated_db, "SELECT error_code FROM ai_api_logs WHERE status = 'error'")
        == "ai_unavailable"
    )
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_all_searches_failing_marks_run_failed(migrated_db: str) -> None:
    with research_client(migrated_db, SearchFails(fail_all=True)) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        start(client, headers, project["id"])
        run = latest_run(client, headers, project["id"])
        assert run["status"] == "failed"
        assert run["error_code"] == "ai_rate_limited"
        assert "límite de uso" in run["error_message"]
        assert {q["status"] for q in run["queries"]} == {"failed"}
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_partial_search_failure_still_completes(migrated_db: str) -> None:
    with research_client(migrated_db, SearchFails(fail_all=False), ai_max_concurrency=1) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        start(client, headers, project["id"])
        run = latest_run(client, headers, project["id"])
        assert run["status"] == "completed"
        statuses = [q["status"] for q in run["queries"]]
        assert statuses.count("failed") == 1
        assert statuses.count("completed") == 5
    run_sql(migrated_db, "TRUNCATE users CASCADE")


class UntrustedOutput(FakeProvider):
    """Salida defectuosa: URLs no http(s), duplicadas y spans fuera del texto."""

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        text = "Dato respaldado. Otro dato."
        return GroundedResult(
            text=text,
            sources=[
                GroundedSource("javascript:alert(1)", "malicioso"),
                GroundedSource("https://WWW.Example.com/a/?utm_medium=x#top", "A"),
                GroundedSource("http://example.com/a", "A duplicada", cited=True),
                GroundedSource("ftp://example.com/archivo"),
            ],
            citations=[
                CitationSpan(0, 16, (0, 1, 2)),
                CitationSpan(10, 999, (1,)),  # fuera del texto
                CitationSpan(17, 27, (3,)),  # fuente descartada
            ],
        )


def test_untrusted_provider_output_is_sanitized(migrated_db: str) -> None:
    with research_client(migrated_db, UntrustedOutput(), research_max_questions=3) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        start(client, headers, project["id"])
        run = latest_run(client, headers, project["id"])
        assert run["status"] == "completed"
        query = run["queries"][0]
        assert [s["url"] for s in query["sources"]] == [
            "https://WWW.Example.com/a/?utm_medium=x#top"
        ]
        assert query["sources"][0]["was_cited"] is True
        assert [e["content"] for e in query["evidence"]] == ["Dato respaldado."]
        sources = client.get(f"{BASE}/{project['id']}/sources", headers=headers).json()
        assert len(sources) == 1
    run_sql(migrated_db, "TRUNCATE users CASCADE")


# ─────────────── Autorización ───────────────


def test_research_is_private(db_client: TestClient, headers: dict) -> None:
    project = structured_project(db_client, headers)
    start(db_client, headers, project["id"])
    run_id = db_client.get(f"{BASE}/{project['id']}/research-runs", headers=headers).json()[0]["id"]
    other = user_headers(db_client, "otra@ideaforge.dev")
    for response in (
        start(db_client, other, project["id"]),
        db_client.get(f"{BASE}/{project['id']}/research-runs", headers=other),
        db_client.get(f"{BASE}/{project['id']}/research-runs/{run_id}", headers=other),
        db_client.get(f"{BASE}/{project['id']}/sources", headers=other),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "project_not_found"


def test_run_must_belong_to_project(db_client: TestClient, headers: dict) -> None:
    project = structured_project(db_client, headers)
    start(db_client, headers, project["id"])
    run_id = db_client.get(f"{BASE}/{project['id']}/research-runs", headers=headers).json()[0]["id"]
    other_project = create_project(db_client, headers, "Otro")
    response = db_client.get(
        f"{BASE}/{other_project['id']}/research-runs/{run_id}", headers=headers
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "research_run_not_found"
