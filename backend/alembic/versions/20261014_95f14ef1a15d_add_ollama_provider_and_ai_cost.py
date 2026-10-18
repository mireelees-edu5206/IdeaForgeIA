"""add Ollama provider and AI cost

Revision ID: 95f14ef1a15d
Revises: a1b3ade021f1
Create Date: 2026-10-14 22:01:51.059372

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "95f14ef1a15d"
down_revision: str | Sequence[str] | None = "a1b3ade021f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.drop_constraint(op.f(f"ck_{table}_{column}"), table, type_="check")
    op.drop_constraint(op.f("ck_ai_api_logs_non_negative_metrics"), "ai_api_logs", type_="check")

    op.execute("UPDATE research_runs SET ai_provider = 'legacy' WHERE ai_provider = 'grok'")
    op.execute("UPDATE reports SET ai_provider = 'legacy' WHERE ai_provider = 'grok'")
    op.execute("UPDATE ai_api_logs SET provider = 'legacy' WHERE provider = 'grok'")

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

    op.add_column(
        "ai_api_logs",
        sa.Column("estimated_cost_usd", sa.Numeric(precision=12, scale=8), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_ai_api_logs_non_negative_metrics"),
        "ai_api_logs",
        "coalesce(input_tokens, 0) >= 0 AND coalesce(output_tokens, 0) >= 0"
        " AND search_queries_count >= 0 AND coalesce(latency_ms, 0) >= 0"
        " AND coalesce(estimated_cost_usd, 0) >= 0",
    )


def downgrade() -> None:
    bind = op.get_bind()
    has_ollama_data = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM research_runs WHERE ai_provider = 'ollama')"
            " OR EXISTS (SELECT 1 FROM reports WHERE ai_provider = 'ollama')"
            " OR EXISTS (SELECT 1 FROM ai_api_logs WHERE provider = 'ollama')"
        )
    ).scalar_one()
    has_cost_data = bind.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM ai_api_logs WHERE estimated_cost_usd IS NOT NULL)")
    ).scalar_one()
    if has_ollama_data or has_cost_data:
        raise RuntimeError(
            "No se puede revertir: hay registros Ollama o costos estimados que se perderían."
        )

    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.drop_constraint(op.f(f"ck_{table}_{column}"), table, type_="check")
    op.drop_constraint(op.f("ck_ai_api_logs_non_negative_metrics"), "ai_api_logs", type_="check")

    op.execute("UPDATE research_runs SET ai_provider = 'grok' WHERE ai_provider = 'legacy'")
    op.execute("UPDATE reports SET ai_provider = 'grok' WHERE ai_provider = 'legacy'")
    op.execute("UPDATE ai_api_logs SET provider = 'grok' WHERE provider = 'legacy'")

    for table, column in (
        ("research_runs", "ai_provider"),
        ("reports", "ai_provider"),
        ("ai_api_logs", "provider"),
    ):
        op.create_check_constraint(
            op.f(f"ck_{table}_{column}"),
            table,
            f"{column} IN ('gemini', 'grok', 'fake')",
        )

    op.create_check_constraint(
        op.f("ck_ai_api_logs_non_negative_metrics"),
        "ai_api_logs",
        "coalesce(input_tokens, 0) >= 0 AND coalesce(output_tokens, 0) >= 0"
        " AND search_queries_count >= 0 AND coalesce(latency_ms, 0) >= 0",
    )
    op.drop_column("ai_api_logs", "estimated_cost_usd")
