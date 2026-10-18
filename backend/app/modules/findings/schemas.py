import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import Level, Origin, ResearchCategory, ReviewStatus
from app.core.schemas import PatchModel
from app.modules.entities.models import EntityType
from app.modules.findings.models import EvidenceStance
from app.modules.research.models import SourceType

Statement = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Rationale = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class EvidenceSourceRead(BaseModel):
    id: uuid.UUID
    url: str
    domain: str
    title: str | None
    source_type: SourceType


class FindingEvidenceRead(BaseModel):
    evidence_id: uuid.UUID
    stance: EvidenceStance
    content: str
    source: EvidenceSourceRead


class FindingEntityRead(BaseModel):
    id: uuid.UUID
    name: str
    entity_type: EntityType


class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_id: uuid.UUID | None
    origin: Origin
    review_status: ReviewStatus
    finding_type: ResearchCategory
    statement: str
    confidence_level: Level
    confidence_rationale: str | None
    created_at: datetime
    updated_at: datetime
    evidence: list[FindingEvidenceRead] = []
    entities: list[FindingEntityRead] = []


class EvidenceLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_id: uuid.UUID
    stance: EvidenceStance = EvidenceStance.SUPPORTS


class FindingCreate(BaseModel):
    """Hallazgo aportado por el usuario (dato suyo): la evidencia es opcional."""

    model_config = ConfigDict(extra="forbid")

    finding_type: ResearchCategory
    statement: Statement
    confidence_level: Level = Level.UNDETERMINED
    confidence_rationale: Rationale | None = None
    evidence: list[EvidenceLink] = Field(default_factory=list, max_length=20)
    entity_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class FindingUpdate(PatchModel):
    review_status: ReviewStatus | None = None
    finding_type: ResearchCategory | None = None
    statement: Statement | None = None
    confidence_level: Level | None = None
    confidence_rationale: Rationale | None = None
