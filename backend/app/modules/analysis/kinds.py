"""Los cuatro tipos de análisis comparten comportamiento; aquí se declara lo que los distingue."""

from dataclasses import dataclass

from pydantic import BaseModel

from app.db.base import Base
from app.modules.analysis import schemas as s
from app.modules.analysis.models import (
    HypothesisFinding,
    MissingInformation,
    Opportunity,
    OpportunityFinding,
    Risk,
    RiskFinding,
    ValidationHypothesis,
)


@dataclass(frozen=True, slots=True)
class AnalysisKind:
    key: str  # segmento de la URL
    label: str  # para mensajes: "La oportunidad no existe."
    model: type[Base]
    link_model: type[Base] | None  # tabla intermedia con findings
    link_fk: str | None
    read: type[s.AnalysisItemRead]
    create: type[BaseModel]
    update: type[BaseModel]
    # Cambiarlos convierte una propuesta de la IA en un dato del usuario.
    content_fields: tuple[str, ...]
    # Seguimiento del usuario: no altera la procedencia.
    tracking_fields: tuple[str, ...] = ()


OPPORTUNITIES = AnalysisKind(
    key="opportunities",
    label="La oportunidad",
    model=Opportunity,
    link_model=OpportunityFinding,
    link_fk="opportunity_id",
    read=s.OpportunityRead,
    create=s.OpportunityCreate,
    update=s.OpportunityUpdate,
    content_fields=("title", "description", "potential"),
)
RISKS = AnalysisKind(
    key="risks",
    label="El riesgo",
    model=Risk,
    link_model=RiskFinding,
    link_fk="risk_id",
    read=s.RiskRead,
    create=s.RiskCreate,
    update=s.RiskUpdate,
    content_fields=("title", "description", "category", "likelihood", "impact", "mitigation"),
)
HYPOTHESES = AnalysisKind(
    key="hypotheses",
    label="La hipótesis",
    model=ValidationHypothesis,
    link_model=HypothesisFinding,
    link_fk="hypothesis_id",
    read=s.HypothesisRead,
    create=s.HypothesisCreate,
    update=s.HypothesisUpdate,
    content_fields=(
        "statement",
        "related_attribute",
        "validation_method",
        "success_criteria",
        "priority",
    ),
    tracking_fields=("validation_status", "result_notes"),
)
# El esquema no tiene tabla intermedia para la información faltante (es lo que NO se encontró).
MISSING_INFORMATION = AnalysisKind(
    key="missing-information",
    label="La información faltante",
    model=MissingInformation,
    link_model=None,
    link_fk=None,
    read=s.MissingInfoRead,
    create=s.MissingInfoCreate,
    update=s.MissingInfoUpdate,
    content_fields=("question", "reason", "related_attribute", "priority"),
    tracking_fields=("resolution_status", "resolution_notes"),
)

KINDS = (OPPORTUNITIES, RISKS, HYPOTHESES, MISSING_INFORMATION)
# Campos de texto opcionales: una cadena vacía se guarda como NULL.
NULLABLE_TEXT = {
    "mitigation",
    "validation_method",
    "success_criteria",
    "result_notes",
    "reason",
    "resolution_notes",
}
