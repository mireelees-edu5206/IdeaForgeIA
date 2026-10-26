import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.enums import AIProviderName
from app.modules.reports.models import ReportSectionType, ReportStatus

ReportText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=20, max_length=6000)
]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
GeoScopeText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=160)
]
GeoKeyword = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class GeographicScopeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: GeoScopeText
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_m: int = Field(default=1000, ge=100, le=5000)
    keyword: GeoKeyword | None = None

    @model_validator(mode="after")
    def validate_coordinates(self) -> "GeographicScopeInput":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Indica ambas coordenadas o deja ambas vacías.")
        return self


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    geographic_scopes: list[GeographicScopeInput] = Field(default_factory=list, max_length=3)

    @field_validator("geographic_scopes")
    @classmethod
    def deduplicate_scopes(cls, scopes: list[GeographicScopeInput]) -> list[GeographicScopeInput]:
        unique: dict[tuple[str, float | None, float | None], GeographicScopeInput] = {}
        for scope in scopes:
            normalized = " ".join(scope.query.split())
            unique.setdefault(
                (normalized, scope.latitude, scope.longitude),
                scope.model_copy(update={"query": normalized}),
            )
        return list(unique.values())


class InvestmentEstimate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minimum_mxn: int = Field(ge=0, le=100_000_000)
    maximum_mxn: int = Field(ge=0, le=100_000_000)
    basis: ReportText
    assumptions: list[ShortText] = Field(min_length=1, max_length=6)
    evidence_refs: list[ShortText] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def validate_range(self) -> "InvestmentEstimate":
        if self.minimum_mxn > self.maximum_mxn:
            raise ValueError("El mínimo de inversión no puede superar el máximo.")
        return self


class ZoneRecommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ShortText
    reason: ReportText
    place_refs: list[ShortText] = Field(default_factory=list, max_length=8)
    caveat: ShortText


class BusinessVerdict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendation: Literal[
        "worth_testing", "needs_validation", "do_not_proceed_yet", "insufficient_information"
    ]
    confidence: Literal["low", "medium", "high"]
    summary: ReportText
    investment: InvestmentEstimate | None = None
    zones: list[ZoneRecommendation] = Field(default_factory=list, max_length=4)
    missing_information: list[ShortText] = Field(default_factory=list, max_length=8)
    next_steps: list[ShortText] = Field(min_length=1, max_length=5)


class ReportDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executive_summary: BusinessVerdict
    idea_overview: ReportText
    market: ReportText
    competition: ReportText
    opportunities: ReportText
    risks: ReportText
    hypotheses: ReportText
    missing_information: ReportText
    conclusions: ReportText


class VerdictInvestmentRead(BaseModel):
    minimum_mxn: int
    maximum_mxn: int
    basis: str
    assumptions: list[str]
    evidence_refs: list[str]


class VerdictZoneRead(BaseModel):
    name: str
    reason: str
    place_refs: list[str]
    caveat: str


class BusinessVerdictRead(BaseModel):
    recommendation: Literal[
        "worth_testing", "needs_validation", "do_not_proceed_yet", "insufficient_information"
    ]
    confidence: Literal["low", "medium", "high"]
    summary: str
    investment: VerdictInvestmentRead | None = None
    zones: list[VerdictZoneRead]
    missing_information: list[str]
    next_steps: list[str]


class ReportSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_type: ReportSectionType
    position: int
    title: str
    content: str
    verdict: BusinessVerdictRead | None = None


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
    ReportSectionType.EXECUTIVE_SUMMARY: "Veredicto final",
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
