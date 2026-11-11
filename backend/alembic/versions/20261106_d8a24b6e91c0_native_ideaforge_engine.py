"""Reemplaza proveedores externos (Gemini y Ollama) por el motor nativo de IdeaForge.

Revision ID: d8a24b6e91c0
Revises: c2149f7d8a31
Create Date: 2026-11-06 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "d8a24b6e91c0"
down_revision: str | Sequence[str] | None = "c2149f7d8a31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Convierte registros antiguos de gemini/ollama a legacy y habilita el motor propio engine."""
    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.drop_constraint(op.f(f"ck_{table}_{column}"), table, type_="check")

    op.execute(
        "UPDATE research_runs SET ai_provider = 'legacy' WHERE ai_provider IN ('gemini', 'ollama')"
    )
    op.execute(
        "UPDATE reports SET ai_provider = 'legacy' WHERE ai_provider IN ('gemini', 'ollama')"
    )
    op.execute("UPDATE ai_api_logs SET provider = 'legacy' WHERE provider IN ('gemini', 'ollama')")

    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.create_check_constraint(
            op.f(f"ck_{table}_{column}"),
            table,
            f"{column} IN ('engine', 'fake', 'legacy')",
        )


def downgrade() -> None:
    """Restaura las restricciones previas convirtiendo engine a legacy."""
    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.drop_constraint(op.f(f"ck_{table}_{column}"), table, type_="check")

    op.execute("UPDATE research_runs SET ai_provider = 'legacy' WHERE ai_provider = 'engine'")
    op.execute("UPDATE reports SET ai_provider = 'legacy' WHERE ai_provider = 'engine'")
    op.execute("UPDATE ai_api_logs SET provider = 'legacy' WHERE provider = 'engine'")

    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.create_check_constraint(
            op.f(f"ck_{table}_{column}"),
            table,
            f"{column} IN ('gemini', 'ollama', 'fake', 'legacy')",
        )
