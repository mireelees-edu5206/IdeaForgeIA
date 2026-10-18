from collections.abc import Sequence

from fastapi.testclient import TestClient

from app.modules.ai.errors import AIUnavailableError
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.types import AIMessage
from app.modules.reports.schemas import ReportDraft
from tests.api.helpers import user_headers
from tests.api.test_analysis import analyze, researched
from tests.api.test_projects import BASE, create_project
from tests.api.test_research import research_client
from tests.conftest import fetch_scalar, run_sql


def test_report_requires_project_analysis(db_client: TestClient, migrated_db: str) -> None:
    headers = user_headers(db_client)
    project = create_project(db_client, headers, "Idea pendiente")

    response = db_client.post(f"{BASE}/{project['id']}/reports", headers=headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "project_not_analyzed"
    assert fetch_scalar(migrated_db, "SELECT count(*) FROM reports") == 0


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
