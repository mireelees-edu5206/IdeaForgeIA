"""Análisis: interpretaciones generadas a partir de los hallazgos (no son hechos comprobados).

ARCHIVO: backend/app/modules/analysis/models.py

¿Qué es?
Las tablas del análisis en la base de datos. Hay cuatro tipos de elementos y, para cada uno, una
tabla de unión que dice en qué hallazgos se apoya:
- opportunities: ventajas posibles de la idea.
- risks: cosas que podrían salir mal, con su probabilidad e impacto.
- validation_hypotheses: afirmaciones que hay que comprobar, con cómo hacerlo.
- missing_information: preguntas que la investigación no pudo responder.

¿Para qué sirve?
Para guardar el análisis de forma que se pueda revisar, aceptar, rechazar o cambiar.

¿Quién lo usa?
generation.py (guarda lo que propone la IA), service.py (reglas), repository y las migraciones.

Importante: todo lo que genera la IA aquí es una interpretación, no un hecho. Por eso cada elemento
tiene un estado de revisión y un origen (IA o persona).
"""

import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from app.core.enums import AttributeType, Level, Priority
from app.db.base import Base, ReviewableMixin, TimestampMixin, UUIDPrimaryKeyMixin, str_enum
from app.modules.research.models import research_run_fk


class RiskCategory(StrEnum):
    """El tipo de riesgo."""

    MARKET = "market"  # El mercado podría no responder.
    COMPETITION = "competition"  # Otros competidores podrían ganar.
    TECHNICAL = "technical"  # Problemas de tecnología o de producción.
    REGULATORY = "regulatory"  # Leyes o permisos.
    FINANCIAL = "financial"  # Dinero: costos, ingresos o financiamiento.
    OPERATIONAL = "operational"  # La operación diaria.
    OTHER = "other"  # Otro tipo.


class ValidationStatus(StrEnum):
    """En qué va la comprobación de una hipótesis."""

    PENDING = "pending"  # Todavía no se comprueba.
    IN_PROGRESS = "in_progress"  # Se está comprobando.
    VALIDATED = "validated"  # Se confirmó.
    INVALIDATED = "invalidated"  # Se descartó.
    INCONCLUSIVE = "inconclusive"  # No se pudo concluir.


class ResolutionStatus(StrEnum):
    """En qué va una pregunta que faltaba responder."""

    OPEN = "open"  # Sigue sin respuesta.
    RESOLVED = "resolved"  # Ya se respondió.
    DISMISSED = "dismissed"  # Se decidió que no importa.


class AnalysisItemMixin(UUIDPrimaryKeyMixin, ReviewableMixin, TimestampMixin):
    """Columnas que comparten los cuatro tipos de análisis.

    Si se borra la investigación de la que salieron, el análisis se conserva (run_id queda vacío).
    """

    @declared_attr.directive
    def __table_args__(cls) -> tuple:
        """Regla de llave foránea: si se borra la investigación, solo se vacía run_id."""
        return (research_run_fk(ondelete="SET NULL (run_id)"),)

    # A qué proyecto pertenece. Si se borra el proyecto, se borra el análisis.
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, sort_order=-90
    )
    # De qué investigación salió. Vacío si lo creó la persona o si la investigación se borró.
    run_id: Mapped[uuid.UUID | None] = mapped_column(sort_order=-89)


class Opportunity(AnalysisItemMixin, Base):
    """Una ventaja posible de la idea."""

    __tablename__ = "opportunities"

    title: Mapped[str] = mapped_column(String(200))  # Título corto, de hasta 200 letras.
    description: Mapped[str]  # Explicación.
    # Qué tanto potencial tiene. Empieza en indeterminado.
    potential: Mapped[Level] = mapped_column(
        str_enum(Level, "potential", 15), server_default=Level.UNDETERMINED.value
    )


class Risk(AnalysisItemMixin, Base):
    """Una cosa que podría salir mal."""

    __tablename__ = "risks"

    title: Mapped[str] = mapped_column(String(200))  # Título corto, de hasta 200 letras.
    description: Mapped[str]  # Explicación.
    category: Mapped[RiskCategory] = mapped_column(str_enum(RiskCategory, "category"))
    # Qué tan probable es y qué tanto daño haría. Ambos empiezan en indeterminado.
    likelihood: Mapped[Level] = mapped_column(
        str_enum(Level, "likelihood", 15), server_default=Level.UNDETERMINED.value
    )
    impact: Mapped[Level] = mapped_column(
        str_enum(Level, "impact", 15), server_default=Level.UNDETERMINED.value
    )
    # Cómo reducir el riesgo. Opcional.
    mitigation: Mapped[str | None]


class ValidationHypothesis(AnalysisItemMixin, Base):
    """Una afirmación que hay que comprobar antes de avanzar."""

    __tablename__ = "validation_hypotheses"

    statement: Mapped[str]  # La afirmación que se quiere comprobar.
    # Qué parte de la idea toca. Opcional.
    related_attribute: Mapped[AttributeType | None] = mapped_column(
        str_enum(AttributeType, "related_attribute", 30)
    )
    validation_method: Mapped[str | None]  # Cómo comprobarla (por ejemplo, entrevistas). Opcional.
    success_criteria: Mapped[str | None]  # Qué resultado la confirmaría. Opcional.
    # Qué tan urgente es comprobarla. Por defecto, media.
    priority: Mapped[Priority] = mapped_column(
        str_enum(Priority, "priority", 10), server_default=Priority.MEDIUM.value
    )
    # En qué va la comprobación. Empieza en pendiente.
    validation_status: Mapped[ValidationStatus] = mapped_column(
        str_enum(ValidationStatus, "validation_status", 15),
        server_default=ValidationStatus.PENDING.value,
    )
    result_notes: Mapped[str | None]  # Lo que se encontró al comprobarla. Opcional.


class MissingInformation(AnalysisItemMixin, Base):
    """Una pregunta que la investigación no pudo responder."""

    __tablename__ = "missing_information"

    question: Mapped[str]  # La pregunta sin respuesta.
    reason: Mapped[str | None]  # Por qué no se respondió. Opcional.
    related_attribute: Mapped[AttributeType | None] = mapped_column(
        str_enum(AttributeType, "related_attribute", 30)
    )
    priority: Mapped[Priority] = mapped_column(
        str_enum(Priority, "priority", 10), server_default=Priority.MEDIUM.value
    )
    # Si ya se resolvió o no. Empieza en abierta.
    resolution_status: Mapped[ResolutionStatus] = mapped_column(
        str_enum(ResolutionStatus, "resolution_status", 10),
        server_default=ResolutionStatus.OPEN.value,
    )
    resolution_notes: Mapped[str | None]  # Cómo se resolvió. Opcional.


class OpportunityFinding(Base):
    """Une una oportunidad con un hallazgo que la respalda."""

    __tablename__ = "opportunity_findings"

    # Juntas forman la llave primaria: cada par (oportunidad, hallazgo) aparece una vez.
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class RiskFinding(Base):
    """Une un riesgo con un hallazgo que lo respalda."""

    __tablename__ = "risk_findings"

    risk_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class HypothesisFinding(Base):
    """Une una hipótesis con un hallazgo que la respalda."""

    __tablename__ = "hypothesis_findings"

    hypothesis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("validation_hypotheses.id", ondelete="CASCADE"), primary_key=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True, index=True
    )
