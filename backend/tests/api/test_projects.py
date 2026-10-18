import pytest
from fastapi.testclient import TestClient

from app.modules.projects.service import MAX_VALUES_PER_ATTRIBUTE
from tests.api.helpers import user_headers
from tests.conftest import fetch_scalar, run_sql

IDEA = "Plataforma que conecta agricultores locales con restaurantes de la ciudad."
BASE = "/api/v1/projects"


@pytest.fixture
def headers(db_client: TestClient) -> dict[str, str]:
    return user_headers(db_client)


def create_project(client: TestClient, headers: dict, title: str = "Agro Conecta") -> dict:
    response = client.post(BASE, json={"title": title, "raw_idea": IDEA}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def add_attribute(client: TestClient, headers: dict, project_id: str, type_: str, value: str):
    return client.post(
        f"{BASE}/{project_id}/attributes",
        json={"attribute_type": type_, "value": value},
        headers=headers,
    )


# ─────────────── Proyectos ───────────────


def test_requires_authentication(db_client: TestClient) -> None:
    assert db_client.get(BASE).status_code == 401


def test_create_project(db_client: TestClient, headers: dict) -> None:
    response = db_client.post(
        BASE, json={"title": "  Agro Conecta  ", "raw_idea": f"  {IDEA}  "}, headers=headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Agro Conecta"
    assert body["raw_idea"] == IDEA
    assert body["status"] == "draft"


def test_create_project_validation(db_client: TestClient, headers: dict) -> None:
    response = db_client.post(
        BASE, json={"title": "   ", "raw_idea": "muy corta", "status": "analyzed"}, headers=headers
    )
    assert response.status_code == 422
    details = {d["field"]: d["message"] for d in response.json()["error"]["details"]}
    assert details == {
        "title": "Este campo no puede estar vacío.",
        "raw_idea": "Debe tener al menos 20 caracteres.",
        "status": "Campo no permitido.",
    }


def test_list_projects_paginated_newest_activity_first(
    db_client: TestClient, headers: dict
) -> None:
    first = create_project(db_client, headers, "Primero")
    create_project(db_client, headers, "Segundo")
    create_project(db_client, headers, "Tercero")

    page = db_client.get(BASE, params={"limit": 2}, headers=headers).json()
    assert page["total"] == 3
    assert [p["title"] for p in page["items"]] == ["Tercero", "Segundo"]
    assert "raw_idea" not in page["items"][0]

    # Actividad en un proyecto (añadir un atributo) lo sube al principio de la lista.
    add_attribute(db_client, headers, first["id"], "problem", "Intermediarios caros")
    titles = [p["title"] for p in db_client.get(BASE, headers=headers).json()["items"]]
    assert titles[0] == "Primero"


def test_list_projects_filter_by_status(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    project = create_project(db_client, headers)
    create_project(db_client, headers, "Otro")
    run_sql(
        migrated_db,
        "UPDATE projects SET status = 'structured' WHERE id = :id",
        {"id": project["id"]},
    )
    page = db_client.get(BASE, params={"status": "structured"}, headers=headers).json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == project["id"]


def test_list_projects_invalid_pagination(db_client: TestClient, headers: dict) -> None:
    assert db_client.get(BASE, params={"limit": 101}, headers=headers).status_code == 422
    assert db_client.get(BASE, params={"offset": -1}, headers=headers).status_code == 422


def test_get_project_detail_with_attributes(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    add_attribute(db_client, headers, project["id"], "solution", "Marketplace B2B")
    add_attribute(db_client, headers, project["id"], "problem", "Intermediarios caros")
    detail = db_client.get(f"{BASE}/{project['id']}", headers=headers).json()
    assert detail["raw_idea"] == IDEA
    # Ordenados según el orden del formulario: problema antes que solución.
    assert [a["attribute_type"] for a in detail["attributes"]] == ["problem", "solution"]


def test_update_project(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    response = db_client.patch(
        f"{BASE}/{project['id']}", json={"title": "Nuevo título"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Nuevo título"
    assert response.json()["raw_idea"] == IDEA
    assert response.json()["updated_at"] > project["updated_at"]


def test_update_project_rejects_null_and_status(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    url = f"{BASE}/{project['id']}"
    assert db_client.patch(url, json={"title": None}, headers=headers).status_code == 422
    assert db_client.patch(url, json={"status": "analyzed"}, headers=headers).status_code == 422


def test_delete_project_cascades(db_client: TestClient, headers: dict, migrated_db: str) -> None:
    project = create_project(db_client, headers)
    add_attribute(db_client, headers, project["id"], "problem", "Intermediarios caros")
    assert db_client.delete(f"{BASE}/{project['id']}", headers=headers).status_code == 204
    assert db_client.get(f"{BASE}/{project['id']}", headers=headers).status_code == 404
    assert fetch_scalar(migrated_db, "SELECT count(*) FROM idea_attributes") == 0


def test_other_users_projects_are_invisible(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    intruder = user_headers(db_client, "intruso@ideaforge.dev")
    url = f"{BASE}/{project['id']}"

    assert db_client.get(BASE, headers=intruder).json()["total"] == 0
    for response in (
        db_client.get(url, headers=intruder),
        db_client.patch(url, json={"title": "Hackeado"}, headers=intruder),
        db_client.delete(url, headers=intruder),
        db_client.get(f"{url}/attributes", headers=intruder),
        add_attribute(db_client, intruder, project["id"], "problem", "x"),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "project_not_found"
    assert db_client.get(url, headers=headers).json()["title"] == "Agro Conecta"


def test_invalid_project_id(db_client: TestClient, headers: dict) -> None:
    assert db_client.get(f"{BASE}/no-es-uuid", headers=headers).status_code == 422


# ─────────────── Atributos ───────────────


def test_user_attributes_are_confirmed_and_positioned(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    first = add_attribute(db_client, headers, project["id"], "channels", "  Venta directa  ")
    second = add_attribute(db_client, headers, project["id"], "channels", "Redes sociales")
    other_type = add_attribute(db_client, headers, project["id"], "problem", "Precios altos")
    assert first.status_code == 201
    assert first.json()["value"] == "Venta directa"
    assert first.json()["origin"] == "user" and first.json()["is_confirmed"] is True
    assert [first.json()["position"], second.json()["position"]] == [0, 1]
    assert other_type.json()["position"] == 0


def test_attribute_validation(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    bad_type = add_attribute(db_client, headers, project["id"], "competitors", "x")
    empty = add_attribute(db_client, headers, project["id"], "problem", "   ")
    assert bad_type.status_code == empty.status_code == 422
    forged = db_client.post(
        f"{BASE}/{project['id']}/attributes",
        json={"attribute_type": "problem", "value": "x", "origin": "ai"},
        headers=headers,
    )
    assert forged.status_code == 422


def test_attribute_limit_per_type(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    for i in range(MAX_VALUES_PER_ATTRIBUTE):
        response = add_attribute(db_client, headers, project["id"], "channels", f"c{i}")
        assert response.status_code == 201
    response = add_attribute(db_client, headers, project["id"], "channels", "uno más")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "attribute_limit_reached"


def test_editing_ai_suggestion_turns_it_into_user_data(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    project = create_project(db_client, headers)
    attribute_id = str(
        fetch_scalar(
            migrated_db,
            "INSERT INTO idea_attributes (project_id, attribute_type, value, origin)"
            " VALUES (:p, 'revenue_model', 'Suscripción mensual', 'ai') RETURNING id",
            {"p": project["id"]},
        )
    )
    url = f"{BASE}/{project['id']}/attributes/{attribute_id}"

    confirmed = db_client.patch(url, json={"is_confirmed": True}, headers=headers).json()
    assert (confirmed["origin"], confirmed["is_confirmed"]) == ("ai", True)

    unconfirmed = db_client.patch(url, json={"is_confirmed": False}, headers=headers).json()
    assert unconfirmed["is_confirmed"] is False

    edited = db_client.patch(url, json={"value": "Comisión por venta"}, headers=headers).json()
    assert (edited["value"], edited["origin"], edited["is_confirmed"]) == (
        "Comisión por venta",
        "user",
        True,
    )


def test_delete_attribute(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    attribute = add_attribute(db_client, headers, project["id"], "problem", "x").json()
    url = f"{BASE}/{project['id']}/attributes/{attribute['id']}"
    assert db_client.delete(url, headers=headers).status_code == 204
    assert db_client.delete(url, headers=headers).status_code == 404
    assert db_client.get(f"{BASE}/{project['id']}/attributes", headers=headers).json() == []


def confirm(client: TestClient, headers: dict, project_id: str):
    return client.post(f"{BASE}/{project_id}/confirm-structure", headers=headers)


def fill_required(client: TestClient, headers: dict, project_id: str) -> None:
    for type_ in ("problem", "solution", "customer_segment"):
        response = add_attribute(client, headers, project_id, type_, f"valor {type_}")
        assert response.status_code == 201


# ─────────────── Estructura y resumen ───────────────


def test_detail_reports_structure_check(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    add_attribute(db_client, headers, project["id"], "problem", "Precios altos")
    structure = db_client.get(f"{BASE}/{project['id']}", headers=headers).json()["structure"]
    assert structure == {
        "ready": False,
        "missing": ["solution", "customer_segment"],
        "pending_suggestions": 0,
    }


def test_confirm_structure_requires_minimum(db_client: TestClient, headers: dict) -> None:
    project = create_project(db_client, headers)
    add_attribute(db_client, headers, project["id"], "problem", "Precios altos")
    response = confirm(db_client, headers, project["id"])
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "structure_incomplete"
    assert [d["field"] for d in error["details"]] == ["solution", "customer_segment"]


def test_confirm_structure_blocked_by_pending_ai_suggestions(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    project = create_project(db_client, headers)
    fill_required(db_client, headers, project["id"])
    run_sql(
        migrated_db,
        "INSERT INTO idea_attributes (project_id, attribute_type, value, origin)"
        " VALUES (:p, 'channels', 'Sugerencia', 'ai')",
        {"p": project["id"]},
    )
    response = confirm(db_client, headers, project["id"])
    assert response.status_code == 400
    assert response.json()["error"]["details"][-1]["field"] == "pending_suggestions"


def test_confirm_structure_and_revert_to_draft_on_edit(
    db_client: TestClient, headers: dict
) -> None:
    project = create_project(db_client, headers)
    fill_required(db_client, headers, project["id"])
    confirmed = confirm(db_client, headers, project["id"])
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "structured"
    assert confirmed.json()["structure"]["ready"] is True
    assert confirm(db_client, headers, project["id"]).status_code == 200  # idempotente

    url = f"{BASE}/{project['id']}"
    # Cambiar solo el título no altera la estructura.
    db_client.patch(url, json={"title": "Otro título"}, headers=headers)
    assert db_client.get(url, headers=headers).json()["status"] == "structured"
    # Cambiar la idea o sus atributos la devuelve a borrador.
    add_attribute(db_client, headers, project["id"], "channels", "Venta directa")
    assert db_client.get(url, headers=headers).json()["status"] == "draft"

    confirm(db_client, headers, project["id"])
    db_client.patch(url, json={"raw_idea": IDEA + " Ahora también cafeterías."}, headers=headers)
    assert db_client.get(url, headers=headers).json()["status"] == "draft"


def test_confirm_structure_rejected_while_researching(
    db_client: TestClient, headers: dict, migrated_db: str
) -> None:
    project = create_project(db_client, headers)
    fill_required(db_client, headers, project["id"])
    run_sql(migrated_db, "UPDATE projects SET status = 'researching'")
    response = confirm(db_client, headers, project["id"])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_status"


def test_projects_overview(db_client: TestClient, headers: dict) -> None:
    empty = db_client.get(f"{BASE}/summary", headers=headers).json()
    assert empty == {
        "total": 0,
        "by_status": {"draft": 0, "structured": 0, "researching": 0, "analyzed": 0},
    }
    project = create_project(db_client, headers)
    create_project(db_client, headers, "Otro")
    fill_required(db_client, headers, project["id"])
    confirm(db_client, headers, project["id"])
    overview = db_client.get(f"{BASE}/summary", headers=headers).json()
    assert overview["total"] == 2
    assert overview["by_status"]["draft"] == 1
    assert overview["by_status"]["structured"] == 1
    # Solo cuenta proyectos propios.
    other = user_headers(db_client, "otra@ideaforge.dev")
    assert db_client.get(f"{BASE}/summary", headers=other).json()["total"] == 0


def test_attribute_must_belong_to_project_in_url(db_client: TestClient, headers: dict) -> None:
    project_a = create_project(db_client, headers, "A")
    project_b = create_project(db_client, headers, "B")
    attribute = add_attribute(db_client, headers, project_a["id"], "problem", "x").json()
    response = db_client.patch(
        f"{BASE}/{project_b['id']}/attributes/{attribute['id']}",
        json={"value": "cambiado"},
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "attribute_not_found"
