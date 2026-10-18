"""Esquema inicial de IdeaForge AI (Fase 2).

Revision ID: a1b3ade021f1
Revises:
Create Date: 2026-09-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a1b3ade021f1"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tablas cuyo updated_at mantiene el trigger set_updated_at().
UPDATED_AT_TABLES = [
    "users",
    "projects",
    "entities",
    "idea_attributes",
    "research_runs",
    "competitors",
    "findings",
    "missing_information",
    "opportunities",
    "risks",
    "validation_hypotheses",
]


def upgrade() -> None:
    # citext y pg_trgm son extensiones "trusted": las puede crear el dueño de la BD.
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        """
        CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END
        $$
        """
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "user", "admin", name="role", native_enum=False, create_constraint=True, length=10
            ),
            server_default="user",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(full_name) <> ''", name=op.f("ck_users_full_name_not_blank")),
        sa.CheckConstraint("char_length(email) <= 254", name=op.f("ck_users_email_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("raw_idea", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "structured",
                "researching",
                "analyzed",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(title) <> ''", name=op.f("ck_projects_title_not_blank")),
        sa.CheckConstraint(
            "char_length(raw_idea) BETWEEN 20 AND 5000", name=op.f("ck_projects_raw_idea_length")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_projects_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(
        "ix_projects_user_id_updated_at",
        "projects",
        ["user_id", sa.literal_column("updated_at DESC")],
        unique=False,
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "expires_at > created_at", name=op.f("ck_refresh_tokens_expiry_after_creation")
        ),
        sa.ForeignKeyConstraint(
            ["replaced_by_id"],
            ["refresh_tokens.id"],
            name=op.f("fk_refresh_tokens_replaced_by_id_refresh_tokens"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)
    op.create_table(
        "entities",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column(
            "entity_type",
            sa.Enum(
                "company",
                "product",
                "technology",
                "organization",
                "other",
                name="entity_type",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("normalized_name", sa.String(length=200), nullable=False),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_entities_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_entities")),
        sa.UniqueConstraint("id", "project_id", name=op.f("uq_entities_id_project_id")),
        sa.UniqueConstraint(
            "project_id",
            "entity_type",
            "normalized_name",
            name=op.f("uq_entities_project_id_entity_type_normalized_name"),
        ),
    )
    op.create_index(
        "ix_entities_normalized_name_trgm",
        "entities",
        ["normalized_name"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"normalized_name": "gin_trgm_ops"},
    )
    op.create_table(
        "idea_attributes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column(
            "attribute_type",
            sa.Enum(
                "problem",
                "solution",
                "customer_segment",
                "product_service",
                "channels",
                "revenue_model",
                "geographic_scope",
                "differentiators",
                "technologies",
                name="attribute_type",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("position", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column("is_confirmed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(value) BETWEEN 1 AND 4000", name=op.f("ck_idea_attributes_value_length")
        ),
        sa.CheckConstraint("position >= 0", name=op.f("ck_idea_attributes_position_non_negative")),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_idea_attributes_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_idea_attributes")),
        sa.UniqueConstraint(
            "project_id",
            "attribute_type",
            "position",
            name=op.f("uq_idea_attributes_project_id_attribute_type_position"),
        ),
    )
    op.create_table(
        "research_runs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "running",
                "completed",
                "failed",
                "interrupted",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "current_step",
            sa.Enum(
                "planning",
                "searching",
                "extracting",
                "analyzing",
                "scoring",
                name="current_step",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=True,
        ),
        sa.Column("progress_pct", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "ai_provider",
            sa.Enum(
                "gemini",
                "grok",
                "fake",
                name="ai_provider",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("ai_model", sa.String(length=100), nullable=False),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at",
            name=op.f("ck_research_runs_dates_order"),
        ),
        sa.CheckConstraint(
            "progress_pct BETWEEN 0 AND 100", name=op.f("ck_research_runs_progress_range")
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_research_runs_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_research_runs")),
        sa.UniqueConstraint("id", "project_id", name=op.f("uq_research_runs_id_project_id")),
    )
    op.create_index(
        "ix_research_runs_project_id_created_at",
        "research_runs",
        ["project_id", sa.literal_column("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "uq_research_runs_one_active",
        "research_runs",
        ["project_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'running')"),
    )
    op.create_table(
        "sources",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("canonical_url", sa.Text(), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column(
            "source_type",
            sa.Enum(
                "news",
                "company_site",
                "government",
                "academic",
                "marketplace",
                "social",
                "blog",
                "review_site",
                "other",
                "unknown",
                name="source_type",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            server_default="unknown",
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_sources_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sources")),
        sa.UniqueConstraint("id", "project_id", name=op.f("uq_sources_id_project_id")),
        sa.UniqueConstraint(
            "project_id", "canonical_url", name=op.f("uq_sources_project_id_canonical_url")
        ),
    )
    op.create_index(
        "ix_sources_project_id_domain", "sources", ["project_id", "domain"], unique=False
    )
    op.create_table(
        "ai_api_logs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("research_run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "provider",
            sa.Enum(
                "gemini",
                "grok",
                "fake",
                name="provider",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column(
            "operation",
            sa.Enum(
                "idea_structuring",
                "research_planning",
                "grounded_search",
                "extraction",
                "analysis",
                "report_generation",
                "chat",
                name="operation",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("prompt_version", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "success",
                "error",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            nullable=False,
        ),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column(
            "search_queries_count", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "coalesce(input_tokens, 0) >= 0 AND coalesce(output_tokens, 0) >= 0 AND search_queries_count >= 0 AND coalesce(latency_ms, 0) >= 0",
            name=op.f("ck_ai_api_logs_non_negative_metrics"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_ai_api_logs_project_id_projects"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["research_run_id"],
            ["research_runs.id"],
            name=op.f("fk_ai_api_logs_research_run_id_research_runs"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_ai_api_logs_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_api_logs")),
    )
    op.create_index(op.f("ix_ai_api_logs_project_id"), "ai_api_logs", ["project_id"], unique=False)
    op.create_index(
        op.f("ix_ai_api_logs_research_run_id"), "ai_api_logs", ["research_run_id"], unique=False
    )
    op.create_index("ix_ai_api_logs_created_at", "ai_api_logs", ["created_at"], unique=False)
    op.create_index(
        "ix_ai_api_logs_user_id_created_at",
        "ai_api_logs",
        ["user_id", sa.literal_column("created_at DESC")],
        unique=False,
    )
    op.create_table(
        "competitors",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "competitor_type",
            sa.Enum(
                "direct",
                "indirect",
                "substitute",
                "alternative",
                name="competitor_type",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            nullable=False,
        ),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column(
            "threat_level",
            sa.Enum(
                "low",
                "medium",
                "high",
                "undetermined",
                name="threat_level",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="undetermined",
            nullable=False,
        ),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column(
            "review_status",
            sa.Enum(
                "proposed",
                "accepted",
                "rejected",
                name="review_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["entity_id", "project_id"],
            ["entities.id", "entities.project_id"],
            name=op.f("fk_competitors_entity_id_project_id_entities"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_competitors_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_competitors_run_id_project_id_research_runs"),
            ondelete="SET NULL (run_id)",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_competitors")),
        sa.UniqueConstraint(
            "project_id", "entity_id", name=op.f("uq_competitors_project_id_entity_id")
        ),
    )
    op.create_table(
        "entity_aliases",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("alias", sa.String(length=200), nullable=False),
        sa.Column("normalized_alias", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["entity_id"],
            ["entities.id"],
            name=op.f("fk_entity_aliases_entity_id_entities"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_entity_aliases")),
        sa.UniqueConstraint(
            "entity_id",
            "normalized_alias",
            name=op.f("uq_entity_aliases_entity_id_normalized_alias"),
        ),
    )
    op.create_index(
        "ix_entity_aliases_normalized_alias_trgm",
        "entity_aliases",
        ["normalized_alias"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"normalized_alias": "gin_trgm_ops"},
    )
    op.create_table(
        "findings",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "finding_type",
            sa.Enum(
                "market",
                "customers",
                "competition",
                "substitutes",
                "technology",
                "regulation",
                "pricing",
                "other",
                name="finding_type",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column(
            "confidence_level",
            sa.Enum(
                "low",
                "medium",
                "high",
                "undetermined",
                name="confidence_level",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="undetermined",
            nullable=False,
        ),
        sa.Column("confidence_score", sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column("confidence_rationale", sa.Text(), nullable=True),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column(
            "review_status",
            sa.Enum(
                "proposed",
                "accepted",
                "rejected",
                name="review_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "origin = 'user' OR run_id IS NOT NULL", name=op.f("ck_findings_ai_requires_run")
        ),
        sa.CheckConstraint(
            "confidence_score BETWEEN 0 AND 1", name=op.f("ck_findings_confidence_score_range")
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_findings_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_findings_run_id_project_id_research_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_findings")),
    )
    op.create_index(op.f("ix_findings_run_id"), "findings", ["run_id"], unique=False)
    op.create_index(
        "ix_findings_project_id_finding_type",
        "findings",
        ["project_id", "finding_type"],
        unique=False,
    )
    op.create_table(
        "missing_information",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "related_attribute",
            sa.Enum(
                "problem",
                "solution",
                "customer_segment",
                "product_service",
                "channels",
                "revenue_model",
                "geographic_scope",
                "differentiators",
                "technologies",
                name="related_attribute",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=True,
        ),
        sa.Column(
            "priority",
            sa.Enum(
                "low",
                "medium",
                "high",
                name="priority",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="medium",
            nullable=False,
        ),
        sa.Column(
            "resolution_status",
            sa.Enum(
                "open",
                "resolved",
                "dismissed",
                name="resolution_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="open",
            nullable=False,
        ),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column(
            "review_status",
            sa.Enum(
                "proposed",
                "accepted",
                "rejected",
                name="review_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_missing_information_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_missing_information_run_id_project_id_research_runs"),
            ondelete="SET NULL (run_id)",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_missing_information")),
    )
    op.create_index(
        op.f("ix_missing_information_project_id"),
        "missing_information",
        ["project_id"],
        unique=False,
    )
    op.create_table(
        "opportunities",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "potential",
            sa.Enum(
                "low",
                "medium",
                "high",
                "undetermined",
                name="potential",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="undetermined",
            nullable=False,
        ),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column(
            "review_status",
            sa.Enum(
                "proposed",
                "accepted",
                "rejected",
                name="review_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_opportunities_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_opportunities_run_id_project_id_research_runs"),
            ondelete="SET NULL (run_id)",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_opportunities")),
    )
    op.create_index(
        op.f("ix_opportunities_project_id"), "opportunities", ["project_id"], unique=False
    )
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "generating",
                "completed",
                "failed",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="generating",
            nullable=False,
        ),
        sa.Column(
            "ai_provider",
            sa.Enum(
                "gemini",
                "grok",
                "fake",
                name="ai_provider",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("ai_model", sa.String(length=100), nullable=False),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("version > 0", name=op.f("ck_reports_version_positive")),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_reports_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_reports_run_id_project_id_research_runs"),
            ondelete="SET NULL (run_id)",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reports")),
        sa.UniqueConstraint("project_id", "version", name=op.f("uq_reports_project_id_version")),
    )
    op.create_table(
        "research_queries",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "market",
                "customers",
                "competition",
                "substitutes",
                "technology",
                "regulation",
                "pricing",
                "other",
                name="category",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "completed",
                "failed",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column(
            "executed_queries",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("search_suggestions_html", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "jsonb_typeof(executed_queries) = 'array'",
            name=op.f("ck_research_queries_executed_queries_array"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["research_runs.id"],
            name=op.f("fk_research_queries_run_id_research_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_research_queries")),
        sa.UniqueConstraint("run_id", "position", name=op.f("uq_research_queries_run_id_position")),
    )
    op.create_table(
        "risks",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "market",
                "competition",
                "technical",
                "regulatory",
                "financial",
                "operational",
                "other",
                name="category",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column(
            "likelihood",
            sa.Enum(
                "low",
                "medium",
                "high",
                "undetermined",
                name="likelihood",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="undetermined",
            nullable=False,
        ),
        sa.Column(
            "impact",
            sa.Enum(
                "low",
                "medium",
                "high",
                "undetermined",
                name="impact",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="undetermined",
            nullable=False,
        ),
        sa.Column("mitigation", sa.Text(), nullable=True),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column(
            "review_status",
            sa.Enum(
                "proposed",
                "accepted",
                "rejected",
                name="review_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_risks_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_risks_run_id_project_id_research_runs"),
            ondelete="SET NULL (run_id)",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_risks")),
    )
    op.create_index(op.f("ix_risks_project_id"), "risks", ["project_id"], unique=False)
    op.create_table(
        "validation_hypotheses",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column(
            "related_attribute",
            sa.Enum(
                "problem",
                "solution",
                "customer_segment",
                "product_service",
                "channels",
                "revenue_model",
                "geographic_scope",
                "differentiators",
                "technologies",
                name="related_attribute",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=True,
        ),
        sa.Column("validation_method", sa.Text(), nullable=True),
        sa.Column("success_criteria", sa.Text(), nullable=True),
        sa.Column(
            "priority",
            sa.Enum(
                "low",
                "medium",
                "high",
                name="priority",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="medium",
            nullable=False,
        ),
        sa.Column(
            "validation_status",
            sa.Enum(
                "pending",
                "in_progress",
                "validated",
                "invalidated",
                "inconclusive",
                name="validation_status",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("result_notes", sa.Text(), nullable=True),
        sa.Column(
            "origin",
            sa.Enum(
                "ai", "user", name="origin", native_enum=False, create_constraint=True, length=10
            ),
            nullable=False,
        ),
        sa.Column(
            "review_status",
            sa.Enum(
                "proposed",
                "accepted",
                "rejected",
                name="review_status",
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_validation_hypotheses_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "project_id"],
            ["research_runs.id", "research_runs.project_id"],
            name=op.f("fk_validation_hypotheses_run_id_project_id_research_runs"),
            ondelete="SET NULL (run_id)",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_validation_hypotheses")),
    )
    op.create_index(
        op.f("ix_validation_hypotheses_project_id"),
        "validation_hypotheses",
        ["project_id"],
        unique=False,
    )
    op.create_table(
        "evidence",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("query_id", sa.Uuid(), nullable=True),
        sa.Column(
            "evidence_kind",
            sa.Enum(
                "cited_claim",
                "source_excerpt",
                name="evidence_kind",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("span_start", sa.Integer(), nullable=True),
        sa.Column("span_end", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "evidence_kind <> 'cited_claim' OR (query_id IS NOT NULL AND span_start IS NOT NULL)",
            name=op.f("ck_evidence_cited_claim_requires_span"),
        ),
        sa.CheckConstraint(
            "(span_start IS NULL AND span_end IS NULL) OR (span_start >= 0 AND span_end > span_start)",
            name=op.f("ck_evidence_span_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_evidence_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["query_id"],
            ["research_queries.id"],
            name=op.f("fk_evidence_query_id_research_queries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_id", "project_id"],
            ["sources.id", "sources.project_id"],
            name=op.f("fk_evidence_source_id_project_id_sources"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence")),
    )
    op.create_index(op.f("ix_evidence_source_id"), "evidence", ["source_id"], unique=False)
    op.create_index(op.f("ix_evidence_project_id"), "evidence", ["project_id"], unique=False)
    op.create_index(op.f("ix_evidence_query_id"), "evidence", ["query_id"], unique=False)
    op.create_table(
        "finding_entities",
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["entity_id"],
            ["entities.id"],
            name=op.f("fk_finding_entities_entity_id_entities"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["findings.id"],
            name=op.f("fk_finding_entities_finding_id_findings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("finding_id", "entity_id", name=op.f("pk_finding_entities")),
    )
    op.create_index(
        op.f("ix_finding_entities_entity_id"), "finding_entities", ["entity_id"], unique=False
    )
    op.create_table(
        "hypothesis_findings",
        sa.Column("hypothesis_id", sa.Uuid(), nullable=False),
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["findings.id"],
            name=op.f("fk_hypothesis_findings_finding_id_findings"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["hypothesis_id"],
            ["validation_hypotheses.id"],
            name=op.f("fk_hypothesis_findings_hypothesis_id_validation_hypotheses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("hypothesis_id", "finding_id", name=op.f("pk_hypothesis_findings")),
    )
    op.create_index(
        op.f("ix_hypothesis_findings_finding_id"),
        "hypothesis_findings",
        ["finding_id"],
        unique=False,
    )
    op.create_table(
        "opportunity_findings",
        sa.Column("opportunity_id", sa.Uuid(), nullable=False),
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["findings.id"],
            name=op.f("fk_opportunity_findings_finding_id_findings"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["opportunities.id"],
            name=op.f("fk_opportunity_findings_opportunity_id_opportunities"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "opportunity_id", "finding_id", name=op.f("pk_opportunity_findings")
        ),
    )
    op.create_index(
        op.f("ix_opportunity_findings_finding_id"),
        "opportunity_findings",
        ["finding_id"],
        unique=False,
    )
    op.create_table(
        "report_sections",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column(
            "section_type",
            sa.Enum(
                "executive_summary",
                "idea_overview",
                "market",
                "competition",
                "opportunities",
                "risks",
                "hypotheses",
                "missing_information",
                "sources",
                "conclusions",
                name="section_type",
                native_enum=False,
                create_constraint=True,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["report_id"],
            ["reports.id"],
            name=op.f("fk_report_sections_report_id_reports"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_sections")),
        sa.UniqueConstraint(
            "report_id", "position", name=op.f("uq_report_sections_report_id_position")
        ),
        sa.UniqueConstraint(
            "report_id", "section_type", name=op.f("uq_report_sections_report_id_section_type")
        ),
    )
    op.create_table(
        "research_query_sources",
        sa.Column("query_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("was_cited", sa.Boolean(), nullable=False),
        sa.Column("rank", sa.SmallInteger(), nullable=True),
        sa.ForeignKeyConstraint(
            ["query_id"],
            ["research_queries.id"],
            name=op.f("fk_research_query_sources_query_id_research_queries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["sources.id"],
            name=op.f("fk_research_query_sources_source_id_sources"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("query_id", "source_id", name=op.f("pk_research_query_sources")),
    )
    op.create_index(
        op.f("ix_research_query_sources_source_id"),
        "research_query_sources",
        ["source_id"],
        unique=False,
    )
    op.create_table(
        "risk_findings",
        sa.Column("risk_id", sa.Uuid(), nullable=False),
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["findings.id"],
            name=op.f("fk_risk_findings_finding_id_findings"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["risk_id"],
            ["risks.id"],
            name=op.f("fk_risk_findings_risk_id_risks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("risk_id", "finding_id", name=op.f("pk_risk_findings")),
    )
    op.create_index(
        op.f("ix_risk_findings_finding_id"), "risk_findings", ["finding_id"], unique=False
    )
    op.create_table(
        "finding_evidence",
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=False),
        sa.Column(
            "stance",
            sa.Enum(
                "supports",
                "contradicts",
                "context",
                name="stance",
                native_enum=False,
                create_constraint=True,
                length=15,
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["evidence_id"],
            ["evidence.id"],
            name=op.f("fk_finding_evidence_evidence_id_evidence"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["findings.id"],
            name=op.f("fk_finding_evidence_finding_id_findings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("finding_id", "evidence_id", name=op.f("pk_finding_evidence")),
    )
    op.create_index(
        op.f("ix_finding_evidence_evidence_id"), "finding_evidence", ["evidence_id"], unique=False
    )

    for table in UPDATED_AT_TABLES:
        op.execute(
            f"CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_finding_evidence_evidence_id"), table_name="finding_evidence")
    op.drop_table("finding_evidence")
    op.drop_index(op.f("ix_risk_findings_finding_id"), table_name="risk_findings")
    op.drop_table("risk_findings")
    op.drop_index(op.f("ix_research_query_sources_source_id"), table_name="research_query_sources")
    op.drop_table("research_query_sources")
    op.drop_table("report_sections")
    op.drop_index(op.f("ix_opportunity_findings_finding_id"), table_name="opportunity_findings")
    op.drop_table("opportunity_findings")
    op.drop_index(op.f("ix_hypothesis_findings_finding_id"), table_name="hypothesis_findings")
    op.drop_table("hypothesis_findings")
    op.drop_index(op.f("ix_finding_entities_entity_id"), table_name="finding_entities")
    op.drop_table("finding_entities")
    op.drop_index(op.f("ix_evidence_source_id"), table_name="evidence")
    op.drop_index(op.f("ix_evidence_project_id"), table_name="evidence")
    op.drop_index(op.f("ix_evidence_query_id"), table_name="evidence")
    op.drop_table("evidence")
    op.drop_index(op.f("ix_validation_hypotheses_project_id"), table_name="validation_hypotheses")
    op.drop_table("validation_hypotheses")
    op.drop_index(op.f("ix_risks_project_id"), table_name="risks")
    op.drop_table("risks")
    op.drop_table("research_queries")
    op.drop_table("reports")
    op.drop_index(op.f("ix_opportunities_project_id"), table_name="opportunities")
    op.drop_table("opportunities")
    op.drop_index(op.f("ix_missing_information_project_id"), table_name="missing_information")
    op.drop_table("missing_information")
    op.drop_index(op.f("ix_findings_run_id"), table_name="findings")
    op.drop_index("ix_findings_project_id_finding_type", table_name="findings")
    op.drop_table("findings")
    op.drop_index(
        "ix_entity_aliases_normalized_alias_trgm",
        table_name="entity_aliases",
        postgresql_using="gin",
        postgresql_ops={"normalized_alias": "gin_trgm_ops"},
    )
    op.drop_table("entity_aliases")
    op.drop_table("competitors")
    op.drop_index(op.f("ix_ai_api_logs_project_id"), table_name="ai_api_logs")
    op.drop_index(op.f("ix_ai_api_logs_research_run_id"), table_name="ai_api_logs")
    op.drop_index("ix_ai_api_logs_created_at", table_name="ai_api_logs")
    op.drop_index("ix_ai_api_logs_user_id_created_at", table_name="ai_api_logs")
    op.drop_table("ai_api_logs")
    op.drop_index("ix_sources_project_id_domain", table_name="sources")
    op.drop_table("sources")
    op.drop_index("ix_research_runs_project_id_created_at", table_name="research_runs")
    op.drop_index(
        "uq_research_runs_one_active",
        table_name="research_runs",
        postgresql_where=sa.text("status IN ('pending', 'running')"),
    )
    op.drop_table("research_runs")
    op.drop_table("idea_attributes")
    op.drop_index(
        "ix_entities_normalized_name_trgm",
        table_name="entities",
        postgresql_using="gin",
        postgresql_ops={"normalized_name": "gin_trgm_ops"},
    )
    op.drop_table("entities")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_projects_user_id_updated_at", table_name="projects")
    op.drop_table("projects")
    op.drop_table("users")

    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP EXTENSION IF EXISTS citext")
