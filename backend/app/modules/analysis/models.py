"""Análisis: interpretaciones generadas a partir de los hallazgos (no son hechos comprobados)."""

import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from app.core.enums import AttributeType, Level, Priority
from app.db.base import Base, ReviewableMixin, TimestampMixin, UUIDPrimaryKeyMixin, str_enum
from app.modules.research.models import research_run_fk


class RiskCategory(StrEnum):
    MARKET = "market"
    COMPETITION = "competition"
    TECHNICAL = "technical"
    REGULATORY = "regulatory"
    FINANCIAL = "financial"
    OPERATIONAL = "operational"
    OTHER = "other"


class ValidationStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    VALIDATED = "validated"
    INVALIDATED = "invalidated"
    INCONCLUSIVE = "inconclusive"


class ResolutionStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class AnalysisItemMixin(UUIDPrimaryKeyMixin, ReviewableMixin, TimestampMixin):
    """Columnas comunes. Si se borra la ejecución, el análisis se conserva (run_id = NULL)."""

    @declared_attr.directive
    def __table_args__(cls) -> tuple:
        return (research_run_fk(ondelete="SET NULL (run_id)"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, sort_order=-90
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(sort_order=-89)


class Opportunity(AnalysisItemMixin, Base):
    __tablename__ = "opportunities"

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str]
    potential: Mapped[Level] = mapped_column(
        str_enum(Level, "potential", 15), server_default=Level.UNDETERMINED.value
    )


class Risk(AnalysisItemMixin, Base):
    __tablename__ = "risks"

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str]
    category: Mapped[RiskCategory] = mapped_column(str_enum(RiskCategory, "category"))
    likelihood: Mapped[Level] = mapped_column(
        str_enum(Level, "likelihood", 15), server_default=Level.UNDETERMINED.value
    )
    impact: Mapped[Level] = mapped_column(
        str_enum(Level, "impact", 15), server_default=Level.UNDETERMINED.value
    )
    mitigation: Mapped[str | None]


class ValidationHypothesis(AnalysisItemMixin, Base):
    __tablename__ = "validation_hypotheses"

    statement: Mapped[str]
    related_attribute: Mapped[AttributeType | None] = mapped_column(
        str_enum(AttributeType, "related_attribute", 30)
    )
    validation_method: Mapped[str | None]
    success_criteria: Mapped[str | None]
    priority: Mapped[Priority] = mapped_column(
        str_enum(Priority, "priority", 10), server_default=Priority.MEDIUM.value
    )
    validation_status: Mapped[ValidationStatus] = mapped_column(
        str_enum(ValidationStatus, "validation_status", 15),
        server_default=ValidationStatus.PENDING.value,
    )
    result_notes: Mapped[str | None]


class MissingInformation(AnalysisItemMixin, Base):
    __tablename__ = "missing_information"

    question: Mapped[str]
    reason: Mapped[str | None]
    related_attribute: Mapped[AttributeType | None] = mapped_column(
        str_enum(AttributeType, "related_attribute", 30)
    )
    priority: Mapped[Priority] = mapped_column(
        str_enum(Priority, "priority", 10), server_default=Priority.MEDIUM.value
    )
    resolution_status: Mapped[ResolutionStatus] = mapped_column(
        str_enum(ResolutionStatus, "resolution_status", 10),
        server_default=ResolutionStatus.OPEN.value,
    )
    resolution_notes: Mapped[str | None]


class OpportunityFinding(Base):
    __tablename__ = "opportunity_findings"

    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class RiskFinding(Base):
    __tablename__ = "risk_findings"

    risk_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class HypothesisFinding(Base):
    __tablename__ = "hypothesis_findings"

    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("validation_hypotheses.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True, index=True
    )
