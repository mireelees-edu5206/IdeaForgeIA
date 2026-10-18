import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import AttributeType, Level, Origin, Priority, ResearchCategory, ReviewStatus
from app.core.schemas import PatchModel
from app.modules.analysis.models import ResolutionStatus, RiskCategory, ValidationStatus

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
FindingIds = Annotated[list[uuid.UUID], Field(default_factory=list, max_length=20)]


class FindingBrief(BaseModel):
    id: uuid.UUID
    finding_type: ResearchCategory
    statement: str
    confidence_level: Level
    review_status: ReviewStatus


class AnalysisItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_id: uuid.UUID | None
    origin: Origin
    review_status: ReviewStatus
    created_at: datetime
    updated_at: datetime
    findings: list[FindingBrief] = []


# ─────────────── Oportunidades ───────────────


class OpportunityFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Text
    potential: Level = Level.UNDETERMINED


class OpportunityCreate(OpportunityFields):
    finding_ids: FindingIds


class OpportunityUpdate(PatchModel):
    title: Title | None = None
    description: Text | None = None
    potential: Level | None = None
    review_status: ReviewStatus | None = None


class OpportunityRead(AnalysisItemRead):
    title: str
    description: str
    potential: Level


# ─────────────── Riesgos ───────────────


class RiskFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Text
    category: RiskCategory = RiskCategory.OTHER
    likelihood: Level = Level.UNDETERMINED
    impact: Level = Level.UNDETERMINED
    mitigation: OptionalText | None = None


class RiskCreate(RiskFields):
    finding_ids: FindingIds


class RiskUpdate(PatchModel):
    title: Title | None = None
    description: Text | None = None
    category: RiskCategory | None = None
    likelihood: Level | None = None
    impact: Level | None = None
    mitigation: OptionalText | None = None
    review_status: ReviewStatus | None = None


class RiskRead(AnalysisItemRead):
    title: str
    description: str
    category: RiskCategory
    likelihood: Level
    impact: Level
    mitigation: str | None


# ─────────────── Hipótesis de validación ───────────────


class HypothesisFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement: Text
    related_attribute: AttributeType | None = None
    validation_method: OptionalText | None = None
    success_criteria: OptionalText | None = None
    priority: Priority = Priority.MEDIUM


class HypothesisCreate(HypothesisFields):
    finding_ids: FindingIds


class HypothesisUpdate(PatchModel):
    statement: Text | None = None
    related_attribute: AttributeType | None = None
    validation_method: OptionalText | None = None
    success_criteria: OptionalText | None = None
    priority: Priority | None = None
    review_status: ReviewStatus | None = None
    # Seguimiento: no cambia la procedencia.
    validation_status: ValidationStatus | None = None
    result_notes: OptionalText | None = None


class HypothesisRead(AnalysisItemRead):
    statement: str
    related_attribute: AttributeType | None
    validation_method: str | None
    success_criteria: str | None
    priority: Priority
    validation_status: ValidationStatus
    result_notes: str | None


# ─────────────── Información faltante ───────────────


class MissingInfoFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Text
    reason: OptionalText | None = None
    related_attribute: AttributeType | None = None
    priority: Priority = Priority.MEDIUM


class MissingInfoCreate(MissingInfoFields):
    """Sin hallazgos vinculados: el esquema no tiene tabla intermedia para lo que falta."""


class MissingInfoUpdate(PatchModel):
    question: Text | None = None
    reason: OptionalText | None = None
    related_attribute: AttributeType | None = None
    priority: Priority | None = None
    review_status: ReviewStatus | None = None
    resolution_status: ResolutionStatus | None = None
    resolution_notes: OptionalText | None = None


class MissingInfoRead(AnalysisItemRead):
    question: str
    reason: str | None
    related_attribute: AttributeType | None
    priority: Priority
    resolution_status: ResolutionStatus
    resolution_notes: str | None


class AnalysisRead(BaseModel):
    opportunities: list[OpportunityRead]
    risks: list[RiskRead]
    hypotheses: list[HypothesisRead]
    missing_information: list[MissingInfoRead]
