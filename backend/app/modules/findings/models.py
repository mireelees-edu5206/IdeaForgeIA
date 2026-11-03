"""Define entidades ORM y restricciones de persistencia. Area: resultados/evidencia.

ARCHIVO: backend/app/modules/findings/models.py

¿Qué es?
Las tablas de los resultados de la investigación en la base de datos:
- evidence: los fragmentos de texto citados (la prueba de que algo dice una fuente).
- findings: los hallazgos, que son afirmaciones sobre la idea (por ejemplo "hay clientes
  dispuestos a pagar por X").
- finding_evidence: qué evidencias respaldan o contradicen cada hallazgo.
- finding_entities: qué empresas se mencionan en cada hallazgo.

¿Para qué sirve?
Para que cada hallazgo se pueda rastrear hasta su fuente. Un hallazgo sin evidencia no debe existir.

¿Quién lo usa?
repository.py (consultas), service.py (reglas), extraction.py (guarda lo que propone la IA) e
research/orchestrator.py.

Reglas importantes que la base de datos hace cumplir:
- Un hallazgo que creó la IA siempre debe tener la investigación de donde salió (ai_requires_run).
- La confianza numérica va de 0 a 1.
- Una evidencia citada siempre debe tener su pregunta y su posición en el texto (span).
"""

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
    """Qué clase de evidencia es."""

    CITED_CLAIM = "cited_claim"  # frase del modelo acompañada de una URL (grounding)
    SOURCE_EXCERPT = "source_excerpt"  # fragmento literal de la fuente


class EvidenceStance(StrEnum):
    """Qué postura tiene una evidencia frente a un hallazgo."""

    SUPPORTS = "supports"  # La evidencia respalda el hallazgo.
    CONTRADICTS = "contradicts"  # La evidencia lo contradice.
    CONTEXT = "context"  # La evidencia solo da contexto, sin apoyar ni contradecir.


class Evidence(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Un fragmento de texto citado de una fuente, con su posición exacta."""

    __tablename__ = "evidence"
    __table_args__ = (
        # La fuente debe pertenecer al mismo proyecto que la evidencia.
        ForeignKeyConstraint(
            ["source_id", "project_id"], ["sources.id", "sources.project_id"], ondelete="CASCADE"
        ),
        # La posición del texto debe ser válida: inicio mayor o igual a 0 y fin mayor que el inicio.
        CheckConstraint(
            "(span_start IS NULL AND span_end IS NULL)"
            " OR (span_start >= 0 AND span_end > span_start)",
            name="span_valid",
        ),
        # Una cita de la IA debe venir de una pregunta y tener posición en el texto.
        CheckConstraint(
            f"evidence_kind <> '{EvidenceKind.CITED_CLAIM.value}'"
            " OR (query_id IS NOT NULL AND span_start IS NOT NULL)",
            name="cited_claim_requires_span",
        ),
    )

    # A qué proyecto pertenece. Si se borra el proyecto, se borra su evidencia.
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    # De qué fuente sale el texto.
    source_id: Mapped[uuid.UUID] = mapped_column(index=True)
    # De qué pregunta de la investigación sale. Vacío si la evidencia no viene de una pregunta.
    query_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("research_queries.id", ondelete="CASCADE"), index=True
    )
    # Qué clase de evidencia es (cita de la IA o fragmento literal).
    evidence_kind: Mapped[EvidenceKind] = mapped_column(str_enum(EvidenceKind, "evidence_kind"))
    # El texto citado.
    content: Mapped[str]
    # Dónde empieza y termina el texto dentro de la respuesta (en letras). Vacíos si no aplica.
    span_start: Mapped[int | None]
    span_end: Mapped[int | None]


class Finding(UUIDPrimaryKeyMixin, ReviewableMixin, TimestampMixin, Base):
    """Un hallazgo: una afirmación sobre la idea, con su nivel de confianza."""

    __tablename__ = "findings"
    __table_args__ = (
        # Si el hallazgo viene de una investigación, debe apuntar a esa investigación del mismo
        # proyecto.
        research_run_fk(ondelete="CASCADE"),
        # La confianza numérica debe estar entre 0 y 1.
        CheckConstraint("confidence_score BETWEEN 0 AND 1", name="confidence_score_range"),
        # Un hallazgo generado por IA siempre debe tener procedencia.
        CheckConstraint("origin = 'user' OR run_id IS NOT NULL", name="ai_requires_run"),
        # Índice para listar los hallazgos de un proyecto por tema.
        Index("ix_findings_project_id_finding_type", "project_id", "finding_type"),
    )

    # A qué proyecto pertenece. Si se borra el proyecto, se borran sus hallazgos.
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # De qué investigación salió. Vacío si lo escribió la persona.
    run_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    # Tema del hallazgo (mercado, clientes, competencia, etc.).
    finding_type: Mapped[ResearchCategory] = mapped_column(
        str_enum(ResearchCategory, "finding_type")
    )
    # El texto del hallazgo.
    statement: Mapped[str]
    # Nivel de confianza: bajo, medio, alto o indeterminado. Empieza en indeterminado.
    confidence_level: Mapped[Level] = mapped_column(
        str_enum(Level, "confidence_level", 15), server_default=Level.UNDETERMINED.value
    )
    # Confianza numérica de 0 a 1 con dos decimales. Vacía si no se calculó.
    confidence_score: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    # Explicación de la confianza, en texto.
    confidence_rationale: Mapped[str | None]


class FindingEvidence(Base):
    """El vínculo entre un hallazgo y una evidencia, con su postura (apoya, contradice o da
    contexto)."""

    __tablename__ = "finding_evidence"

    # Juntas forman la llave primaria: una evidencia se vincula una sola vez a cada hallazgo.
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True
    )
    evidence_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evidence.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    # La postura de esa evidencia frente a este hallazgo.
    stance: Mapped[EvidenceStance] = mapped_column(str_enum(EvidenceStance, "stance", 15))


class FindingEntity(Base):
    """El vínculo entre un hallazgo y una empresa u organización que menciona."""

    __tablename__ = "finding_entities"

    # Juntas forman la llave primaria: una entidad se vincula una sola vez a cada hallazgo.
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE"), primary_key=True, index=True
    )
