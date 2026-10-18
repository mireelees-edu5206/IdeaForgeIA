import uuid
from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator, model_validator

from app.core.enums import Level, Origin, ReviewStatus
from app.core.schemas import PatchModel
from app.modules.entities.models import CompetitorType, EntityType
from app.modules.research.urls import normalize_url

EntityName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class EntityBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: EntityType
    name: str
    website: str | None
    description: str | None


class EntityRead(EntityBrief):
    finding_count: int
    competitor_id: uuid.UUID | None


class CompetitorRead(BaseModel):
    id: uuid.UUID
    entity: EntityBrief
    competitor_type: CompetitorType
    threat_level: Level
    rationale: str | None
    origin: Origin
    review_status: ReviewStatus
    run_id: uuid.UUID | None
    finding_count: int
    created_at: datetime
    updated_at: datetime


class CompetitorCreate(BaseModel):
    """Competidor aportado por el usuario: sobre una entidad existente o una nueva por nombre."""

    model_config = ConfigDict(extra="forbid")

    entity_id: uuid.UUID | None = None
    name: EntityName | None = None
    entity_type: EntityType = EntityType.COMPANY
    website: str | None = None
    description: LongText | None = None
    competitor_type: CompetitorType
    threat_level: Level = Level.UNDETERMINED
    rationale: LongText | None = None

    @field_validator("website")
    @classmethod
    def valid_website(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = normalize_url(value)
        if normalized is None:
            raise ValueError("El sitio web debe ser una URL http(s) válida.")
        return normalized.canonical

    @model_validator(mode="after")
    def entity_or_name(self) -> Self:
        if (self.entity_id is None) == (self.name is None):
            raise ValueError("Indica una entidad existente o el nombre de una nueva, no ambos.")
        return self


class CompetitorUpdate(PatchModel):
    competitor_type: CompetitorType | None = None
    threat_level: Level | None = None
    rationale: LongText | None = None
    review_status: ReviewStatus | None = None
