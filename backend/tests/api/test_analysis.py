from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient

from app.modules.ai.errors import AIUnavailableError
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.types import AIMessage
from app.modules.analysis.generation import AnalysisResult
from tests.api.helpers import user_headers
from tests.api.test_projects import BASE, add_attribute, confirm, create_project
from tests.api.test_research import (
    latest_run,
    project_status,
    research_client,
    start,
    structured_project,
)
from tests.conftest import fetch_scalar, run_sql


@pytest.fixture
def headers(db_client: TestClient) -> dict[str, str]:
    return user_headers(db_client)


def analyze(client: TestClient, headers: dict, project_id: str, run_id: str):
    return client.post(f"{BASE}/{project_id}/research-runs/{run_id}/analysis", headers=headers)


def analysis(client: TestClient, headers: dict, project_id: str, **params) -> dict:
    response = client.get(f"{BASE}/{project_id}/analysis", params=params, headers=headers)
    assert response.status_code == 200
    return response.json()


def researched(client: TestClient, headers: dict) -> tuple[str, str]:
    project = structured_project(client, headers)
    assert start(client, headers, project["id"]).status_code == 202
    return project["id"], latest_run(client, headers, project["id"])["id"]


@pytest.fixture
def analyzed(db_client: TestClient, headers: dict) -> tuple[str, str]:
    pid, run_id = researched(db_client, headers)
    assert analyze(db_client, headers, pid, run_id).status_code == 202
    return pid, run_id


# ─────────────── Generación ───────────────


def test_analysis_generates_items_with_support_rules(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    pid, run_id = researched(db_client, headers)
    response = analyze(db_client, headers, pid, run_id)
    assert response.status_code == 202
    assert response.json()["status"] == "running"
    assert response.json()["current_step"] == "analyzing"

    run = latest_run(db_client, headers, pid)
    assert run["status"] == "completed"
    assert run["progress_pct"] == 100
    assert run["error_code"] is None
    assert project_status(db_client, headers, pid) == "analyzed"

    data = analysis(db_client, headers, pid, run_id=run_id)
    # Sin hallazgos que las respalden, la oportunidad y el riesgo inventados se descartan.
    assert [o["title"] for o in data["opportunities"]] == [
        "[Simulado] Nicho con poca oferta especializada"
    ]
    assert len(data["opportunities"][0]["findings"]) == 2
    assert [r["title"] for r in data["risks"]] == ["[Simulado] Competidor establecido"]
    assert data["risks"][0]["impact"] == "high"
    # Las hipótesis pueden no tener hallazgo.
    assert [len(h["findings"]) for h in data["hypotheses"]] == [1, 0]
    assert data["hypotheses"][0]["validation_status"] == "pending"
    assert len(data["missing_information"]) == 1
    everything = [item for items in data.values() for item in items]
    assert all(i["origin"] == "ai" and i["review_status"] == "proposed" for i in everything)
    assert all(i["run_id"] == run_id for i in everything)
    assert (
        fetch_scalar(migrated_db, "SELECT count(*) FROM ai_api_logs WHERE operation = 'analysis'")
        == 1
    )


class RecordingProvider(FakeProvider):
    def __init__(self) -> None:
        super().__init__()
        self.analysis_prompt = ""

    async def generate_structured(self, messages: Sequence[AIMessage], schema):
        if schema is AnalysisResult:
            self.analysis_prompt = messages[-1].content
        return await super().generate_structured(messages, schema)


def test_rejected_findings_are_excluded(migrated_db: str) -> None:
    provider = RecordingProvider()
    with research_client(migrated_db, provider) as client:
        headers = user_headers(client)
        pid, run_id = researched(client, headers)
        findings = client.get(f"{BASE}/{pid}/findings", headers=headers).json()
        rejected = findings[0]
        client.patch(
            f"{BASE}/{pid}/findings/{rejected['id']}",
            json={"review_status": "rejected"},
            headers=headers,
        )
        client.post(
            f"{BASE}/{pid}/findings",
            json={"finding_type": "customers", "statement": "Hallazgo propio del usuario"},
            headers=headers,
        )
        assert analyze(client, headers, pid, run_id).status_code == 202
        assert rejected["statement"] not in provider.analysis_prompt
        assert "Hallazgo propio del usuario" in provider.analysis_prompt
        assert "| usuario |" in provider.analysis_prompt

        # Si se rechaza todo y no hay hallazgos propios, no hay nada que analizar.
        for finding in client.get(f"{BASE}/{pid}/findings", headers=headers).json():
            client.patch(
                f"{BASE}/{pid}/findings/{finding['id']}",
                json={"review_status": "rejected"},
                headers=headers,
            )
        response = analyze(client, headers, pid, run_id)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "no_findings"
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_reanalysis_replaces_only_unreviewed_proposals(
    db_client: TestClient, headers: dict, analyzed: tuple[str, str]
) -> None:
    pid, run_id = analyzed
    opportunity = analysis(db_client, headers, pid)["opportunities"][0]
    db_client.patch(
        f"{BASE}/{pid}/opportunities/{opportunity['id']}",
        json={"review_status": "accepted"},
        headers=headers,
    )
    assert analyze(db_client, headers, pid, run_id).status_code == 202
    data = analysis(db_client, headers, pid, run_id=run_id)
    assert len(data["opportunities"]) == 2  # la aceptada se conserva + la nueva
    assert opportunity["id"] in {o["id"] for o in data["opportunities"]}
    assert len(data["hypotheses"]) == 2  # las no revisadas se sustituyen
    assert len(data["missing_information"]) == 1


# ─────────────── Precondiciones y estados ───────────────


def test_analysis_preconditions(db_client: TestClient, headers: dict, migrated_db: str) -> None:
    pid, run_id = researched(db_client, headers)
    other = create_project(db_client, headers, "Otro")
    response = analyze(db_client, headers, other["id"], run_id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "research_run_not_found"

    # Una investigación nueva deja la anterior como no analizable.
    assert start(db_client, headers, pid).status_code == 202
    response = analyze(db_client, headers, pid, run_id)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "run_not_latest"

    # Si la idea cambió desde la investigación, hay que investigar de nuevo.
    add_attribute(db_client, headers, pid, "channels", "Venta directa")
    latest = latest_run(db_client, headers, pid)["id"]
    response = analyze(db_client, headers, pid, latest)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "project_not_researched"

    confirm(db_client, headers, pid)
    run_sql(migrated_db, "UPDATE research_runs SET status = 'failed' WHERE id = :r", {"r": latest})
    run_sql(migrated_db, "UPDATE projects SET status = 'researching' WHERE id = :p", {"p": pid})
    response = analyze(db_client, headers, pid, latest)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "run_not_completed"


def test_active_analysis_blocks_edits(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    pid, run_id = researched(db_client, headers)
    run_sql(
        migrated_db,
        "UPDATE research_runs SET status = 'running', current_step = 'analyzing' WHERE id = :r",
        {"r": run_id},
    )
    response = add_attribute(db_client, headers, pid, "channels", "Venta directa")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "research_in_progress"
    response = analyze(db_client, headers, pid, run_id)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "research_in_progress"


class AnalysisFails(FakeProvider):
    async def generate_structured(self, messages: Sequence[AIMessage], schema):
        if schema is AnalysisResult:
            raise AIUnavailableError()
        return await super().generate_structured(messages, schema)


def test_analysis_failure_keeps_research(migrated_db: str) -> None:
    with research_client(migrated_db, AnalysisFails()) as client:
        headers = user_headers(client)
        pid, run_id = researched(client, headers)
        analyze(client, headers, pid, run_id)
        run = latest_run(client, headers, pid)
        assert run["status"] == "completed"
        assert run["error_code"] == "ai_unavailable"
        assert "no está disponible" in run["error_message"]
        assert project_status(client, headers, pid) == "researching"
        assert client.get(f"{BASE}/{pid}/findings", headers=headers).json()
    assert (
        fetch_scalar(migrated_db, "SELECT error_code FROM ai_api_logs WHERE operation = 'analysis'")
        == "ai_unavailable"
    )
    run_sql(migrated_db, "TRUNCATE users CASCADE")


def test_interrupted_analysis_is_recovered(migrated_db: str) -> None:
    with research_client(migrated_db) as client:
        headers = user_headers(client)
        pid, run_id = researched(client, headers)
    run_sql(
        migrated_db,
        "UPDATE research_runs SET status = 'running', current_step = 'analyzing' WHERE id = :r",
        {"r": run_id},
    )
    with research_client(migrated_db, research_recover_on_startup=True) as client:
        run = latest_run(client, headers, pid)
        assert run["status"] == "completed"
        assert run["error_code"] == "analysis_interrupted"
        assert project_status(client, headers, pid) == "researching"
    run_sql(migrated_db, "TRUNCATE users CASCADE")


# ─────────────── Revisión, seguimiento y alta manual ───────────────


def test_review_edit_and_tracking(
    db_client: TestClient, headers: dict, analyzed: tuple[str, str]
) -> None:
    pid, _ = analyzed
    data = analysis(db_client, headers, pid)
    hypothesis = data["hypotheses"][0]
    url = f"{BASE}/{pid}/hypotheses/{hypothesis['id']}"

    # El seguimiento no cambia la procedencia ni la revisión.
    tracked = db_client.patch(
        url,
        json={"validation_status": "validated", "result_notes": "  7 de 10 aceptaron  "},
        headers=headers,
    ).json()
    assert tracked["validation_status"] == "validated"
    assert tracked["result_notes"] == "7 de 10 aceptaron"
    assert tracked["origin"] == "ai"
    assert tracked["review_status"] == "proposed"

    edited = db_client.patch(url, json={"priority": "low"}, headers=headers).json()
    assert edited["origin"] == "user"
    assert edited["review_status"] == "accepted"
    assert len(edited["findings"]) == 1  # conserva sus hallazgos

    missing = data["missing_information"][0]
    resolved = db_client.patch(
        f"{BASE}/{pid}/missing-information/{missing['id']}",
        json={"resolution_status": "resolved", "resolution_notes": ""},
        headers=headers,
    ).json()
    assert resolved["resolution_status"] == "resolved"
    assert resolved["resolution_notes"] is None

    risk = data["risks"][0]
    rejected = db_client.patch(
        f"{BASE}/{pid}/risks/{risk['id']}", json={"review_status": "rejected"}, headers=headers
    ).json()
    assert rejected["origin"] == "ai"
    assert rejected["review_status"] == "rejected"
    response = db_client.delete(f"{BASE}/{pid}/risks/{risk['id']}", headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ai_item_not_deletable"


def test_manual_items(db_client: TestClient, headers: dict, analyzed: tuple[str, str]) -> None:
    pid, run_id = analyzed
    finding_id = db_client.get(f"{BASE}/{pid}/findings", headers=headers).json()[0]["id"]
    payloads = {
        "opportunities": {
            "title": "Alianza con mercados",
            "description": "Vender en ferias.",
            "potential": "high",
            "finding_ids": [finding_id],
        },
        "risks": {
            "title": "Estacionalidad",
            "description": "Menos oferta en invierno.",
            "category": "operational",
            "mitigation": "",
        },
        "hypotheses": {"statement": "Pagarían por entrega en 24 h", "priority": "high"},
        "missing-information": {"question": "¿Qué margen tienen los productores?"},
    }
    for key, payload in payloads.items():
        response = db_client.post(f"{BASE}/{pid}/{key}", json=payload, headers=headers)
        assert response.status_code == 201, (key, response.text)
        created = response.json()
        assert created["origin"] == "user"
        assert created["review_status"] == "accepted"
        assert created["run_id"] is None

    data = analysis(db_client, headers, pid, run_id=run_id)
    manual = next(o for o in data["opportunities"] if o["origin"] == "user")
    assert manual["findings"][0]["id"] == finding_id
    assert next(r for r in data["risks"] if r["origin"] == "user")["mitigation"] is None

    # La información faltante no admite hallazgos vinculados.
    response = db_client.post(
        f"{BASE}/{pid}/missing-information",
        json={"question": "¿Algo?", "finding_ids": [finding_id]},
        headers=headers,
    )
    assert response.status_code == 422

    other = create_project(db_client, headers, "Otro")
    response = db_client.post(
        f"{BASE}/{other['id']}/opportunities",
        json={"title": "X", "description": "Y", "finding_ids": [finding_id]},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_finding"

    response = db_client.delete(f"{BASE}/{pid}/opportunities/{manual['id']}", headers=headers)
    assert response.status_code == 204
    # Un id de otro tipo de análisis no sirve.
    risk_id = data["risks"][0]["id"]
    response = db_client.patch(
        f"{BASE}/{pid}/hypotheses/{risk_id}", json={"priority": "low"}, headers=headers
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "analysis_item_not_found"


def test_analysis_is_private(
    db_client: TestClient, headers: dict, analyzed: tuple[str, str]
) -> None:
    pid, run_id = analyzed
    opportunity = analysis(db_client, headers, pid)["opportunities"][0]
    other = user_headers(db_client, "otra@ideaforge.dev")
    for response in (
        analyze(db_client, other, pid, run_id),
        db_client.get(f"{BASE}/{pid}/analysis", headers=other),
        db_client.post(f"{BASE}/{pid}/hypotheses", json={"statement": "Algo"}, headers=other),
        db_client.patch(
            f"{BASE}/{pid}/opportunities/{opportunity['id']}",
            json={"review_status": "accepted"},
            headers=other,
        ),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "project_not_found"
