import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AIProviderName, ResearchCategory
from app.db.base import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class RunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    INTERRUPTED = "interrupted"


ACTIVE_RUN_STATUSES = (RunStatus.PENDING, RunStatus.RUNNING)


class RunStep(StrEnum):
    PLANNING = "planning"
    SEARCHING = "searching"
    EXTRACTING = "extracting"
    ANALYZING = "analyzing"
    SCORING = "scoring"


class QueryStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceType(StrEnum):
    NEWS = "news"
    COMPANY_SITE = "company_site"
    GOVERNMENT = "government"
    ACADEMIC = "academic"
    MARKETPLACE = "marketplace"
    SOCIAL = "social"
    BLOG = "blog"
    REVIEW_SITE = "review_site"
    OTHER = "other"
    UNKNOWN = "unknown"


def research_run_fk(ondelete: str) -> ForeignKeyConstraint:
    """FK compuesta (run_id, project_id): garantiza que la ejecución sea del mismo proyecto."""
    return ForeignKeyConstraint(
        ["run_id", "project_id"],
        ["research_runs.id", "research_runs.project_id"],
        ondelete=ondelete,
    )


class ResearchRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "research_runs"
    __table_args__ = (
        UniqueConstraint("id", "project_id"),
        CheckConstraint("progress_pct BETWEEN 0 AND 100", name="progress_range"),
        CheckConstraint(
            "finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at",
            name="dates_order",
        ),
        Index("ix_research_runs_project_id_created_at", "project_id", text("created_at DESC")),
        # Una sola ejecución activa por proyecto.
        Index(
            "uq_research_runs_one_active",
            "project_id",
            unique=True,
            postgresql_where=text(
                "status IN (" + ", ".join(f"'{s.value}'" for s in ACTIVE_RUN_STATUSES) + ")"
            ),
        ),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    status: Mapped[RunStatus] = mapped_column(
        str_enum(RunStatus, "status"), server_default=RunStatus.PENDING.value
    )
    current_step: Mapped[RunStep | None] = mapped_column(str_enum(RunStep, "current_step"))
    progress_pct: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    ai_provider: Mapped[AIProviderName] = mapped_column(str_enum(AIProviderName, "ai_provider"))
    ai_model: Mapped[str] = mapped_column(String(100))
    error_code: Mapped[str | None] = mapped_column(String(50))
    error_message: Mapped[str | None]
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]


class ResearchQuery(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "research_queries"
    __table_args__ = (
        UniqueConstraint("run_id", "position"),
        CheckConstraint("jsonb_typeof(executed_queries) = 'array'", name="executed_queries_array"),
    )

    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(SmallInteger)
    category: Mapped[ResearchCategory] = mapped_column(str_enum(ResearchCategory, "category"))
    question: Mapped[str]
    status: Mapped[QueryStatus] = mapped_column(
        str_enum(QueryStatus, "status"), server_default=QueryStatus.PENDING.value
    )
    # Respuesta con grounding; los spans de la evidencia apuntan a este texto.
    response_text: Mapped[str | None]
    executed_queries: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    # HTML de Google Search Suggestions (Gemini). Se muestra solo en un iframe sandbox.
    search_suggestions_html: Mapped[str | None]
    completed_at: Mapped[datetime | None]


class Source(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "sources"
    __table_args__ = (
        UniqueConstraint("project_id", "canonical_url"),
        UniqueConstraint("id", "project_id"),
        Index("ix_sources_project_id_domain", "project_id", "domain"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    url: Mapped[str]
    canonical_url: Mapped[str]
    domain: Mapped[str] = mapped_column(String(255))
    title: Mapped[str | None]
    source_type: Mapped[SourceType] = mapped_column(
        str_enum(SourceType, "source_type"), server_default=SourceType.UNKNOWN.value
    )
    published_at: Mapped[datetime | None]


class ResearchQuerySource(Base):
    __tablename__ = "research_query_sources"

    query_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("research_queries.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    # False = el proveedor visitó la URL pero no la citó en la respuesta.
    was_cited: Mapped[bool]
    rank: Mapped[int | None] = mapped_column(SmallInteger)
