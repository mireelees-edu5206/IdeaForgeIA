import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import AIProviderName, ResearchCategory
from app.modules.research.models import QueryStatus, RunStatus, RunStep, SourceType

# ─────────────── Salida estructurada de la IA ───────────────


class PlannedQuestion(BaseModel):
    category: ResearchCategory
    question: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=500)
    ]


class ResearchPlan(BaseModel):
    """Plan de investigación que devuelve la IA (se valida antes de guardarlo)."""

    questions: list[PlannedQuestion] = Field(min_length=1, max_length=20)


# ─────────────── API ───────────────


class ResearchRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: RunStatus
    current_step: RunStep | None
    progress_pct: int
    ai_provider: AIProviderName
    ai_model: str
    error_code: str | None
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class QuerySourceRead(BaseModel):
    source_id: uuid.UUID
    url: str
    domain: str
    title: str | None
    source_type: SourceType
    was_cited: bool
    rank: int | None


class EvidenceRead(BaseModel):
    """Fragmento de la respuesta respaldado por una fuente (cita del proveedor)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_id: uuid.UUID
    content: str
    span_start: int | None
    span_end: int | None


class ResearchQueryRead(BaseModel):
    id: uuid.UUID
    position: int
    category: ResearchCategory
    question: str
    status: QueryStatus
    response_text: str | None
    executed_queries: list[str]
    search_suggestions_html: str | None
    completed_at: datetime | None
    sources: list[QuerySourceRead]
    evidence: list[EvidenceRead]


class ResearchRunDetail(ResearchRunRead):
    queries: list[ResearchQueryRead]


class SourceRead(BaseModel):
    id: uuid.UUID
    url: str
    domain: str
    title: str | None
    source_type: SourceType
    created_at: datetime
    citation_count: int  # consultas que la citaron
    evidence_count: int
