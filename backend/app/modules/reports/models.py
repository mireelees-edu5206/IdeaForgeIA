import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AIProviderName
from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, str_enum
from app.modules.research.models import research_run_fk


class ReportStatus(StrEnum):
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportSectionType(StrEnum):
    EXECUTIVE_SUMMARY = "executive_summary"
    IDEA_OVERVIEW = "idea_overview"
    MARKET = "market"
    COMPETITION = "competition"
    OPPORTUNITIES = "opportunities"
    RISKS = "risks"
    HYPOTHESES = "hypotheses"
    MISSING_INFORMATION = "missing_information"
    SOURCES = "sources"
    CONCLUSIONS = "conclusions"


class Report(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("project_id", "version"),
        research_run_fk(ondelete="SET NULL (run_id)"),
        CheckConstraint("version > 0", name="version_positive"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    run_id: Mapped[uuid.UUID | None]
    version: Mapped[int]
    title: Mapped[str] = mapped_column(String(200))
    geographic_scopes: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    status: Mapped[ReportStatus] = mapped_column(
        str_enum(ReportStatus, "status", 15), server_default=ReportStatus.GENERATING.value
    )
    ai_provider: Mapped[AIProviderName] = mapped_column(str_enum(AIProviderName, "ai_provider"))
    ai_model: Mapped[str] = mapped_column(String(100))
    error_code: Mapped[str | None] = mapped_column(String(50))
    completed_at: Mapped[datetime | None]


class ReportSection(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "report_sections"
    __table_args__ = (
        UniqueConstraint("report_id", "position"),
        UniqueConstraint("report_id", "section_type"),
    )

    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"))
    section_type: Mapped[ReportSectionType] = mapped_column(
        str_enum(ReportSectionType, "section_type", 30)
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    title: Mapped[str] = mapped_column(String(200))
    # Markdown; el frontend lo renderiza sin permitir HTML crudo.
    content: Mapped[str]
    verdict: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
