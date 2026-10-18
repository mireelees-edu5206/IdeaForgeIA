import uuid

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

import app.db.models  # noqa: F401
from app.db.base import Base

pytestmark = pytest.mark.anyio

IDEA = "Una plataforma que conecta agricultores locales con restaurantes."


async def _user(conn: AsyncConnection, email: str = "ana@example.com") -> uuid.UUID:
    result = await conn.execute(
        text(
            "INSERT INTO users (email, password_hash, full_name)"
            " VALUES (:e, 'x', 'Ana') RETURNING id"
        ),
        {"e": email},
    )
    return result.scalar_one()


async def _project(conn: AsyncConnection, user_id: uuid.UUID) -> uuid.UUID:
    result = await conn.execute(
        text("INSERT INTO projects (user_id, title, raw_idea) VALUES (:u, 'P', :i) RETURNING id"),
        {"u": user_id, "i": IDEA},
    )
    return result.scalar_one()


async def _run(conn: AsyncConnection, project_id: uuid.UUID, status: str = "pending") -> uuid.UUID:
    result = await conn.execute(
        text(
            "INSERT INTO research_runs (project_id, status, ai_provider, ai_model)"
            " VALUES (:p, :s, 'fake', 'fake-1') RETURNING id"
        ),
        {"p": project_id, "s": status},
    )
    return result.scalar_one()


async def _source(conn: AsyncConnection, project_id: uuid.UUID) -> uuid.UUID:
    result = await conn.execute(
        text(
            "INSERT INTO sources (project_id, url, canonical_url, domain)"
            " VALUES (:p, 'https://a.com/x', 'https://a.com/x', 'a.com') RETURNING id"
        ),
        {"p": project_id},
    )
    return result.scalar_one()


async def _expect_integrity_error(conn: AsyncConnection, sql: str, params: dict) -> None:
    with pytest.raises(IntegrityError):
        async with conn.begin_nested():
            await conn.execute(text(sql), params)


async def test_models_match_migrations(conn: AsyncConnection) -> None:
    def diff(sync_conn):  # type: ignore[no-untyped-def]
        context = MigrationContext.configure(sync_conn, opts={"compare_type": True})
        return compare_metadata(context, Base.metadata)

    assert await conn.run_sync(diff) == []


async def test_uuidv7_primary_keys(conn: AsyncConnection) -> None:
    user_id = await _user(conn)
    assert user_id.version == 7


async def test_email_is_case_insensitive_unique(conn: AsyncConnection) -> None:
    await _user(conn, "ana@example.com")
    await _expect_integrity_error(
        conn,
        "INSERT INTO users (email, password_hash, full_name) VALUES ('ANA@example.com', 'x', 'A')",
        {},
    )


async def test_updated_at_trigger(conn: AsyncConnection) -> None:
    user_id = await _user(conn)
    await conn.execute(
        text("UPDATE users SET updated_at = '2000-01-01' WHERE id = :u"), {"u": user_id}
    )
    changed = await conn.execute(
        text("UPDATE users SET full_name = 'Ana B' WHERE id = :u RETURNING updated_at = now()"),
        {"u": user_id},
    )
    assert changed.scalar_one() is True


async def test_raw_idea_length_check(conn: AsyncConnection) -> None:
    user_id = await _user(conn)
    await _expect_integrity_error(
        conn,
        "INSERT INTO projects (user_id, title, raw_idea) VALUES (:u, 'P', 'corta')",
        {"u": user_id},
    )


async def test_only_one_active_run_per_project(conn: AsyncConnection) -> None:
    project_id = await _project(conn, await _user(conn))
    await _run(conn, project_id, "running")
    await _run(conn, project_id, "completed")  # las finalizadas no cuentan
    await _expect_integrity_error(
        conn,
        "INSERT INTO research_runs (project_id, ai_provider, ai_model) VALUES (:p, 'fake', 'f')",
        {"p": project_id},
    )


async def test_evidence_cannot_mix_projects(conn: AsyncConnection) -> None:
    user_id = await _user(conn)
    project_a, project_b = await _project(conn, user_id), await _project(conn, user_id)
    source_a = await _source(conn, project_a)
    await _expect_integrity_error(
        conn,
        "INSERT INTO evidence (project_id, source_id, evidence_kind, content)"
        " VALUES (:p, :s, 'source_excerpt', 'texto')",
        {"p": project_b, "s": source_a},
    )


async def test_cited_claim_requires_query_and_span(conn: AsyncConnection) -> None:
    project_id = await _project(conn, await _user(conn))
    source_id = await _source(conn, project_id)
    await _expect_integrity_error(
        conn,
        "INSERT INTO evidence (project_id, source_id, evidence_kind, content)"
        " VALUES (:p, :s, 'cited_claim', 'texto')",
        {"p": project_id, "s": source_id},
    )


async def test_ai_finding_requires_run(conn: AsyncConnection) -> None:
    project_id = await _project(conn, await _user(conn))
    await _expect_integrity_error(
        conn,
        "INSERT INTO findings (project_id, finding_type, statement, origin)"
        " VALUES (:p, 'market', 'x', 'ai')",
        {"p": project_id},
    )


async def test_deleting_run_keeps_analysis(conn: AsyncConnection) -> None:
    project_id = await _project(conn, await _user(conn))
    run_id = await _run(conn, project_id)
    risk = await conn.execute(
        text(
            "INSERT INTO risks (project_id, run_id, title, description, category, origin)"
            " VALUES (:p, :r, 'R', 'D', 'market', 'ai') RETURNING id"
        ),
        {"p": project_id, "r": run_id},
    )
    risk_id = risk.scalar_one()
    await conn.execute(text("DELETE FROM research_runs WHERE id = :r"), {"r": run_id})
    row = await conn.execute(
        text("SELECT project_id, run_id FROM risks WHERE id = :id"), {"id": risk_id}
    )
    assert row.one() == (project_id, None)


async def test_deleting_project_cascades_and_keeps_ai_logs(conn: AsyncConnection) -> None:
    user_id = await _user(conn)
    project_id = await _project(conn, user_id)
    await _source(conn, project_id)
    log = await conn.execute(
        text(
            "INSERT INTO ai_api_logs (user_id, project_id, provider, model, operation, status)"
            " VALUES (:u, :p, 'fake', 'f', 'analysis', 'success') RETURNING id"
        ),
        {"u": user_id, "p": project_id},
    )
    log_id = log.scalar_one()
    await conn.execute(text("DELETE FROM projects WHERE id = :p"), {"p": project_id})

    sources = await conn.execute(
        text("SELECT count(*) FROM sources WHERE project_id = :p"), {"p": project_id}
    )
    assert sources.scalar_one() == 0
    kept = await conn.execute(
        text("SELECT project_id FROM ai_api_logs WHERE id = :id"), {"id": log_id}
    )
    assert kept.scalar_one() is None
