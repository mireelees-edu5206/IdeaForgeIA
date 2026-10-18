import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import AIProviderName
from app.modules.reports.models import ReportSectionType, ReportStatus

ReportText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=80, max_length=6000)
]


class ReportDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executive_summary: ReportText
    idea_overview: ReportText
    market: ReportText
    competition: ReportText
    opportunities: ReportText
    risks: ReportText
    hypotheses: ReportText
    missing_information: ReportText
    conclusions: ReportText


class ReportSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_type: ReportSectionType
    position: int
    title: str
    content: str


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    run_id: uuid.UUID | None
    version: int
    title: str
    status: ReportStatus
    ai_provider: AIProviderName
    ai_model: str
    error_code: str | None
    created_at: datetime
    completed_at: datetime | None


class ReportDetail(ReportRead):
    sections: list[ReportSectionRead] = Field(default_factory=list)


class ReportListItem(ReportRead):
    section_count: int = 0


SECTION_TITLES: dict[ReportSectionType, str] = {
    ReportSectionType.EXECUTIVE_SUMMARY: "Resumen ejecutivo",
    ReportSectionType.IDEA_OVERVIEW: "La idea y su propuesta",
    ReportSectionType.MARKET: "Mercado y clientes",
    ReportSectionType.COMPETITION: "Competencia y alternativas",
    ReportSectionType.OPPORTUNITIES: "Oportunidades",
    ReportSectionType.RISKS: "Riesgos",
    ReportSectionType.HYPOTHESES: "Hipótesis por validar",
    ReportSectionType.MISSING_INFORMATION: "Información pendiente",
    ReportSectionType.SOURCES: "Hallazgos, evidencias y fuentes",
    ReportSectionType.CONCLUSIONS: "Conclusiones y próximos pasos",
}
