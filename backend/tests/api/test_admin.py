import uuid

import pytest
from fastapi.testclient import TestClient

from tests.api.helpers import auth_header, login, register, user_headers
from tests.api.test_projects import create_project
from tests.conftest import run_sql


def admin_headers(
    client: TestClient, migrated_db: str, email: str = "admin@ideaforge.dev"
) -> dict[str, str]:
    assert register(client, email=email).status_code == 201
    run_sql(migrated_db, "UPDATE users SET role = 'admin' WHERE email = :e", {"e": email})
    tokens = login(client, email=email).json()
    return auth_header(tokens["access_token"])


def test_admin_endpoints_reject_standard_users(db_client: TestClient) -> None:
    headers = user_headers(db_client)
    assert db_client.get("/api/v1/admin/overview", headers=headers).status_code == 403
    assert db_client.get("/api/v1/admin/users", headers=headers).status_code == 403
    assert (
        db_client.delete(
            "/api/v1/admin/users/00000000-0000-0000-0000-000000000001",
            headers=headers,
        ).status_code
        == 403
    )


def test_admin_overview_and_user_management_revokes_deactivated_sessions(
    db_client: TestClient, migrated_db: str
) -> None:
    researcher_headers = user_headers(db_client, email="investigador@ideaforge.dev")
    create_project(db_client, researcher_headers, "Idea supervisada")
    admin_hdrs = admin_headers(db_client, migrated_db)

    overview = db_client.get("/api/v1/admin/overview", headers=admin_hdrs)
    assert overview.status_code == 200
    body = overview.json()
    assert body["total_users"] == 2
    assert body["admin_users"] == 1
    assert body["total_projects"] == 1
    assert body["projects_by_status"]["draft"] == 1

    users = db_client.get("/api/v1/admin/users", headers=admin_hdrs).json()
    researcher = next(u for u in users if u["email"] == "investigador@ideaforge.dev")
    admin_user = next(u for u in users if u["email"] == "admin@ideaforge.dev")
    assert researcher["project_count"] == 1

    # Un administrador no puede quitarse el rol ni desactivarse a sí mismo.
    self_demote = db_client.patch(
        f"/api/v1/admin/users/{admin_user['id']}",
        json={"role": "user"},
        headers=admin_hdrs,
    )
    assert self_demote.status_code == 409
    assert self_demote.json()["error"]["code"] == "cannot_demote_self"

    # Desactivar a otro usuario bloquea su acceso inmediato.
    deactivated = db_client.patch(
        f"/api/v1/admin/users/{researcher['id']}",
        json={"is_active": False},
        headers=admin_hdrs,
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    assert db_client.get("/api/v1/users/me", headers=researcher_headers).status_code == 401


def test_admin_can_delete_another_users_account_and_owned_projects(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    researcher_headers = user_headers(db_client, email="borrar@ideaforge.dev")
    create_project(db_client, researcher_headers, "Idea para eliminar")
    supabase_user_id = uuid.uuid4()
    run_sql(
        migrated_db,
        "UPDATE users SET supabase_user_id = :id WHERE email = :email",
        {"id": supabase_user_id, "email": "borrar@ideaforge.dev"},
    )
    deleted_supabase_ids: list[uuid.UUID] = []
    monkeypatch.setattr(
        "app.core.supabase_admin.SupabaseAdminClient.delete_user",
        lambda _client, user_id: deleted_supabase_ids.append(user_id),
    )
    admin_hdrs = admin_headers(db_client, migrated_db)

    users = db_client.get("/api/v1/admin/users", headers=admin_hdrs).json()
    researcher = next(u for u in users if u["email"] == "borrar@ideaforge.dev")
    response = db_client.delete(
        f"/api/v1/admin/users/{researcher['id']}",
        headers=admin_hdrs,
    )

    assert response.status_code == 204
    assert response.content == b""
    assert deleted_supabase_ids == [supabase_user_id]
    users_after_delete = db_client.get("/api/v1/admin/users", headers=admin_hdrs).json()
    assert all(user["email"] != "borrar@ideaforge.dev" for user in users_after_delete)
    assert db_client.get("/api/v1/users/me", headers=researcher_headers).status_code == 401
    assert db_client.get("/api/v1/projects", headers=researcher_headers).status_code == 401
    assert db_client.get("/api/v1/admin/overview", headers=admin_hdrs).json()["total_projects"] == 0


def test_admin_cannot_delete_own_account(db_client: TestClient, migrated_db: str) -> None:
    admin_hdrs = admin_headers(db_client, migrated_db)
    admin_user = next(
        user
        for user in db_client.get("/api/v1/admin/users", headers=admin_hdrs).json()
        if user["email"] == "admin@ideaforge.dev"
    )

    response = db_client.delete(
        f"/api/v1/admin/users/{admin_user['id']}",
        headers=admin_hdrs,
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "cannot_delete_self"


def test_deleting_supabase_linked_user_requires_server_key(
    db_client: TestClient, migrated_db: str
) -> None:
    researcher_headers = user_headers(db_client, email="linked@ideaforge.dev")
    supabase_user_id = uuid.uuid4()
    run_sql(
        migrated_db,
        "UPDATE users SET supabase_user_id = :id WHERE email = :email",
        {"id": supabase_user_id, "email": "linked@ideaforge.dev"},
    )
    admin_hdrs = admin_headers(db_client, migrated_db)
    researcher = next(
        user
        for user in db_client.get("/api/v1/admin/users", headers=admin_hdrs).json()
        if user["email"] == "linked@ideaforge.dev"
    )

    response = db_client.delete(
        f"/api/v1/admin/users/{researcher['id']}",
        headers=admin_hdrs,
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "supabase_account_deletion_unavailable"
    assert db_client.get("/api/v1/users/me", headers=researcher_headers).status_code == 200
