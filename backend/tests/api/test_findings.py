from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient

from app.modules.ai.errors import AIInvalidResponseError
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.types import AIMessage
from app.modules.findings.extraction import ExtractionResult
from tests.api.helpers import user_headers
from tests.api.test_projects import BASE, create_project
from tests.api.test_research import latest_run, research_client, start, structured_project
from tests.conftest import fetch_scalar, run_sql


@pytest.fixture
def headers(db_client: TestClient) -> dict[str, str]:
    return user_headers(db_client)


@pytest.fixture
def researched(db_client: TestClient, headers: dict) -> dict:
    project = structured_project(db_client, headers)
    assert start(db_client, headers, project["id"]).status_code == 202
    return project


def findings_url(project_id: str) -> str:
    return f"{BASE}/{project_id}/findings"


def competitors_url(project_id: str) -> str:
    return f"{BASE}/{project_id}/competitors"


# ─────────────── Extracción ───────────────


def test_extraction_creates_findings_backed_by_evidence(
    db_client: TestClient, headers: dict, researched: dict, migrated_db: str
) -> None:
    pid = researched["id"]
    run = latest_run(db_client, headers, pid)
    assert run["status"] == "completed"
    assert run["error_code"] is None

    findings = db_client.get(findings_url(pid), headers=headers).json()
    # 6 preguntas × 2 evidencias → 6 hallazgos con dos fuentes + 1 con una sola.
    # El que cita E999 (inexistente) se descarta.
    assert len(findings) == 7
    assert all(f["origin"] == "ai" and f["review_status"] == "proposed" for f in findings)
    assert all(f["run_id"] == run["id"] for f in findings)
    assert all(f["evidence"] for f in findings)
    assert not any("sin evidencia real" in f["statement"] for f in findings)

    paired = [f for f in findings if len(f["evidence"]) == 2]
    assert len(paired) == 6
    assert {f["confidence_level"] for f in paired} == {"high"}
    assert {e["source"]["domain"] for e in paired[0]["evidence"]} == {"example.com", "example.org"}
    assert paired[0]["entities"][0]["name"] == "Competidor Simulado"

    single = next(f for f in findings if len(f["evidence"]) == 1)
    assert single["confidence_level"] == "medium"
    assert "limitado a 'media'" in single["confidence_rationale"]
    # Ordenados por confianza: las altas primero.
    assert findings[-1]["id"] == single["id"]

    # La evidencia enlazada es la cita guardada en la Fase 9.
    evidence = paired[0]["evidence"][0]
    assert evidence["stance"] == "supports"
    assert evidence["content"].startswith("Una fuente simulada")


def test_extraction_deduplicates_entities_and_drops_invented_ones(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    pid = researched["id"]
    entities = db_client.get(f"{BASE}/{pid}/entities", headers=headers).json()
    assert [e["name"] for e in entities] == ["Competidor Simulado"]
    assert entities[0]["finding_count"] == 6
    assert entities[0]["website"] == "https://example.org/competidor-simulado"

    competitors = db_client.get(competitors_url(pid), headers=headers).json()
    assert len(competitors) == 1
    competitor = competitors[0]
    assert competitor["competitor_type"] == "direct"
    assert competitor["threat_level"] == "medium"
    assert competitor["origin"] == "ai"
    assert competitor["review_status"] == "proposed"
    assert competitor["entity"]["id"] == entities[0]["id"]
    assert entities[0]["competitor_id"] == competitor["id"]


def test_rerun_respects_reviewed_competitors(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    pid = researched["id"]
    competitor = db_client.get(competitors_url(pid), headers=headers).json()[0]
    db_client.patch(
        f"{competitors_url(pid)}/{competitor['id']}",
        json={"competitor_type": "indirect", "threat_level": "high"},
        headers=headers,
    )
    assert start(db_client, headers, pid).status_code == 202

    competitors = db_client.get(competitors_url(pid), headers=headers).json()
    assert len(competitors) == 1
    assert competitors[0]["competitor_type"] == "indirect"
    assert competitors[0]["origin"] == "user"
    # Los hallazgos de cada investigación se conservan y se pueden filtrar por ejecución.
    runs = db_client.get(f"{BASE}/{pid}/research-runs", headers=headers).json()
    assert len(db_client.get(findings_url(pid), headers=headers).json()) == 14
    latest = db_client.get(findings_url(pid), params={"run_id": runs[0]["id"]}, headers=headers)
    assert len(latest.json()) == 7


class ExtractionFails(FakeProvider):
    async def generate_structured(self, messages: Sequence[AIMessage], schema):
        if schema is ExtractionResult:
            raise AIInvalidResponseError()
        return await super().generate_structured(messages, schema)


def test_extraction_failure_keeps_search_results(migrated_db: str) -> None:
    with research_client(migrated_db, ExtractionFails()) as client:
        headers = user_headers(client)
        project = structured_project(client, headers)
        start(client, headers, project["id"])
        run = latest_run(client, headers, project["id"])
        assert run["status"] == "completed"
        assert run["error_code"] == "extraction_failed"
        assert "no se pudieron extraer" in run["error_message"]
        assert all(q["status"] == "completed" for q in run["queries"])
        assert client.get(findings_url(project["id"]), headers=headers).json() == []
    assert (
        fetch_scalar(
            migrated_db, "SELECT error_code FROM ai_api_logs WHERE operation = 'extraction'"
        )
        == "ai_invalid_response"
    )
    run_sql(migrated_db, "TRUNCATE users CASCADE")


# ─────────────── Revisión y edición de hallazgos ───────────────


def test_review_and_edit_ai_finding(db_client: TestClient, headers: dict, researched: dict) -> None:
    pid = researched["id"]
    finding = db_client.get(findings_url(pid), headers=headers).json()[0]
    url = f"{findings_url(pid)}/{finding['id']}"

    accepted = db_client.patch(url, json={"review_status": "accepted"}, headers=headers).json()
    assert accepted["review_status"] == "accepted"
    assert accepted["origin"] == "ai"  # revisar no cambia el origen
    rejected = db_client.patch(url, json={"review_status": "rejected"}, headers=headers).json()
    assert rejected["review_status"] == "rejected"
    only_rejected = db_client.get(
        findings_url(pid), params={"review_status": "rejected"}, headers=headers
    ).json()
    assert [f["id"] for f in only_rejected] == [finding["id"]]

    # Reescribirlo lo convierte en dato del usuario (conserva su evidencia).
    edited = db_client.patch(url, json={"statement": "Mi redacción"}, headers=headers).json()
    assert edited["origin"] == "user"
    assert edited["review_status"] == "accepted"
    assert len(edited["evidence"]) == len(finding["evidence"])


def test_ai_finding_cannot_be_deleted(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    pid = researched["id"]
    finding = db_client.get(findings_url(pid), headers=headers).json()[0]
    response = db_client.delete(f"{findings_url(pid)}/{finding['id']}", headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ai_item_not_deletable"


def test_create_manual_finding_with_own_evidence(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    pid = researched["id"]
    ai_finding = db_client.get(findings_url(pid), headers=headers).json()[0]
    evidence_id = ai_finding["evidence"][0]["evidence_id"]
    entity_id = ai_finding["entities"][0]["id"]

    response = db_client.post(
        findings_url(pid),
        json={
            "finding_type": "pricing",
            "statement": "  Los restaurantes pagan 20 % más a intermediarios.  ",
            "confidence_level": "medium",
            "evidence": [{"evidence_id": evidence_id, "stance": "contradicts"}],
            "entity_ids": [entity_id],
        },
        headers=headers,
    )
    assert response.status_code == 201
    created = response.json()
    assert created["origin"] == "user"
    assert created["review_status"] == "accepted"
    assert created["run_id"] is None
    assert created["statement"] == "Los restaurantes pagan 20 % más a intermediarios."
    assert created["evidence"][0]["stance"] == "contradicts"
    assert created["entities"][0]["id"] == entity_id

    # Los hallazgos del usuario aparecen también al filtrar por ejecución, y se pueden borrar.
    run_id = ai_finding["run_id"]
    by_run = db_client.get(findings_url(pid), params={"run_id": run_id}, headers=headers).json()
    assert created["id"] in {f["id"] for f in by_run}
    assert (
        db_client.delete(f"{findings_url(pid)}/{created['id']}", headers=headers).status_code == 204
    )


def test_manual_finding_rejects_evidence_from_other_project(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    evidence_id = db_client.get(findings_url(researched["id"]), headers=headers).json()[0][
        "evidence"
    ][0]["evidence_id"]
    other = create_project(db_client, headers, "Otro")
    for payload, code in (
        ({"evidence": [{"evidence_id": evidence_id}]}, "invalid_evidence"),
        ({"entity_ids": [evidence_id]}, "invalid_entity"),
    ):
        response = db_client.post(
            findings_url(other["id"]),
            json={"finding_type": "market", "statement": "Algo", **payload},
            headers=headers,
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == code
    assert db_client.get(findings_url(other["id"]), headers=headers).json() == []


def test_manual_finding_validation(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    response = db_client.post(
        findings_url(project["id"]),
        json={"finding_type": "otra", "statement": "  ", "origin": "ai"},
        headers=headers,
    )
    assert response.status_code == 422
    fields = {d["field"] for d in response.json()["error"]["details"]}
    assert fields == {"finding_type", "statement", "origin"}


# ─────────────── Competidores ───────────────


def test_manual_competitors(db_client: TestClient, headers: dict, researched: dict) -> None:
    pid = researched["id"]
    url = competitors_url(pid)
    response = db_client.post(
        url,
        json={
            "name": "Mercado Fresco S.A. de C.V.",
            "website": "https://www.mercadofresco.mx/?utm_source=x",
            "competitor_type": "substitute",
            "threat_level": "low",
            "rationale": "Venden directo a restaurantes.",
        },
        headers=headers,
    )
    assert response.status_code == 201
    created = response.json()
    assert created["origin"] == "user"
    assert created["review_status"] == "accepted"
    assert created["entity"]["website"] == "https://mercadofresco.mx/"

    # El mismo nombre (sin sufijo legal ni mayúsculas) es la misma entidad → 409.
    duplicate = db_client.post(
        url, json={"name": "mercado fresco", "competitor_type": "direct"}, headers=headers
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "competitor_exists"

    invalid = db_client.post(
        url,
        json={"name": "X", "website": "javascript:alert(1)", "competitor_type": "direct"},
        headers=headers,
    )
    assert invalid.status_code == 422

    assert db_client.delete(f"{url}/{created['id']}", headers=headers).status_code == 204
    ai_competitor = db_client.get(url, headers=headers).json()[0]
    response = db_client.delete(f"{url}/{ai_competitor['id']}", headers=headers)
    assert response.status_code == 409


def test_competitor_from_existing_entity(
    db_client: TestClient, headers: dict, researched: dict, migrated_db: str
) -> None:
    pid = researched["id"]
    entity_id = db_client.get(f"{BASE}/{pid}/entities", headers=headers).json()[0]["id"]
    url = competitors_url(pid)
    both = db_client.post(
        url,
        json={"entity_id": entity_id, "name": "X", "competitor_type": "direct"},
        headers=headers,
    )
    assert both.status_code == 422
    # Ya es competidor (propuesto por la IA).
    again = db_client.post(
        url, json={"entity_id": entity_id, "competitor_type": "direct"}, headers=headers
    )
    assert again.status_code == 409

    run_sql(migrated_db, "DELETE FROM competitors")
    created = db_client.post(
        url, json={"entity_id": entity_id, "competitor_type": "alternative"}, headers=headers
    )
    assert created.status_code == 201
    assert created.json()["finding_count"] == 6


def test_competitor_cannot_link_entity_from_another_project(
    db_client: TestClient, headers: dict
) -> None:
    source_project = create_project(db_client, headers, "Proyecto de origen")
    source_competitor = db_client.post(
        competitors_url(source_project["id"]),
        json={"name": "Entidad privada", "competitor_type": "direct"},
        headers=headers,
    )
    assert source_competitor.status_code == 201

    target_project = create_project(db_client, headers, "Proyecto destino")
    response = db_client.post(
        competitors_url(target_project["id"]),
        json={
            "entity_id": source_competitor.json()["entity"]["id"],
            "competitor_type": "direct",
        },
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "entity_not_found"


def test_competitor_review_keeps_origin(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    pid = researched["id"]
    competitor = db_client.get(competitors_url(pid), headers=headers).json()[0]
    url = f"{competitors_url(pid)}/{competitor['id']}"
    reviewed = db_client.patch(url, json={"review_status": "rejected"}, headers=headers).json()
    assert reviewed["origin"] == "ai"
    assert reviewed["review_status"] == "rejected"
    reclassified = db_client.patch(url, json={"threat_level": "high"}, headers=headers).json()
    assert reclassified["origin"] == "user"
    assert reclassified["review_status"] == "accepted"


# ─────────────── Autorización ───────────────


def test_findings_and_competitors_are_private(
    db_client: TestClient, headers: dict, researched: dict
) -> None:
    pid = researched["id"]
    finding = db_client.get(findings_url(pid), headers=headers).json()[0]
    competitor = db_client.get(competitors_url(pid), headers=headers).json()[0]
    other = user_headers(db_client, "otra@ideaforge.dev")
    for response in (
        db_client.get(findings_url(pid), headers=other),
        db_client.patch(
            f"{findings_url(pid)}/{finding['id']}",
            json={"review_status": "accepted"},
            headers=other,
        ),
        db_client.get(f"{BASE}/{pid}/entities", headers=other),
        db_client.get(competitors_url(pid), headers=other),
        db_client.delete(f"{competitors_url(pid)}/{competitor['id']}", headers=other),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "project_not_found"

    # Un id de otro proyecto propio tampoco sirve.
    mine = create_project(db_client, headers, "Otro mío")
    response = db_client.patch(
        f"{findings_url(mine['id'])}/{finding['id']}",
        json={"review_status": "accepted"},
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "finding_not_found"
