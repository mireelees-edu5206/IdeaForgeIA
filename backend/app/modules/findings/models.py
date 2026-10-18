import uuid
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import Level, ResearchCategory
from app.db.base import (
    Base,
    CreatedAtMixin,
    ReviewableMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
)
from app.modules.research.models import research_run_fk


class EvidenceKind(StrEnum):
    CITED_CLAIM = "cited_claim"  # frase del modelo acompañada de una URL (grounding)
    SOURCE_EXCERPT = "source_excerpt"  # fragmento literal de la fuente


class EvidenceStance(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    CONTEXT = "context"


class Evidence(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "evidence"
    __table_args__ = (
        ForeignKeyConstraint(
            ["source_id", "project_id"], ["sources.id", "sources.project_id"], ondelete="CASCADE"
        ),
        CheckConstraint(
            "(span_start IS NULL AND span_end IS NULL)"
            " OR (span_start >= 0 AND span_end > span_start)",
            name="span_valid",
        ),
        CheckConstraint(
            f"evidence_kind <> '{EvidenceKind.CITED_CLAIM.value}'"
            " OR (query_id IS NOT NULL AND span_start IS NOT NULL)",
            name="cited_claim_requires_span",
        ),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(index=True)
    query_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("research_queries.id", ondelete="CASCADE"), index=True
    )
    evidence_kind: Mapped[EvidenceKind] = mapped_column(str_enum(EvidenceKind, "evidence_kind"))
    content: Mapped[str]
    span_start: Mapped[int | None]
    span_end: Mapped[int | None]


class Finding(UUIDPrimaryKeyMixin, ReviewableMixin, TimestampMixin, Base):
    __tablename__ = "findings"
    __table_args__ = (
        research_run_fk(ondelete="CASCADE"),
        CheckConstraint("confidence_score BETWEEN 0 AND 1", name="confidence_score_range"),
        # Un hallazgo generado por IA siempre debe tener procedencia.
        CheckConstraint("origin = 'user' OR run_id IS NOT NULL", name="ai_requires_run"),
        Index("ix_findings_project_id_finding_type", "project_id", "finding_type"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    run_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    finding_type: Mapped[ResearchCategory] = mapped_column(
        str_enum(ResearchCategory, "finding_type")
    )
    statement: Mapped[str]
    confidence_level: Mapped[Level] = mapped_column(
        str_enum(Level, "confidence_level", 15), server_default=Level.UNDETERMINED.value
    )
    confidence_score: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    confidence_rationale: Mapped[str | None]


class FindingEvidence(Base):
    __tablename__ = "finding_evidence"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True
    )
    evidence_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evidence.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    stance: Mapped[EvidenceStance] = mapped_column(str_enum(EvidenceStance, "stance", 15))


class FindingEntity(Base):
    __tablename__ = "finding_entities"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE"), primary_key=True, index=True
    )
