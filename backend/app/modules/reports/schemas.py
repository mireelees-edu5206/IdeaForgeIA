"""Valida contratos de entrada/salida. Area: informes/veredicto.

ARCHIVO: backend/app/modules/reports/schemas.py

¿Qué es?
Las "fichas" del informe final:
- Entrada: las zonas geográficas que la persona quiere consultar (máximo 3).
- Lo que devuelve la IA: el veredicto (una recomendación con confianza, resumen, inversión estimada,
  zonas, faltantes y próximos pasos) y las secciones del informe en texto.
- Salida: lo que el frontend recibe, incluido el informe completo con sus secciones.

¿Para qué sirve?
Para que el veredicto siempre tenga la misma forma y no pueda inventar campos. Por ejemplo, una
inversión mínima no puede ser mayor que la máxima, y las coordenadas van en pareja (o ninguna).

¿Quién lo usa?
router.py, service.py, runner.py, generation.py y fake_responses.py.

Límites importantes:
- Hasta 3 zonas geográficas por informe; radio entre 100 y 5000 metros (por defecto 1000).
- Cada texto de sección entre 20 y 6000 letras.
- Un veredicto tiene de 1 a 5 próximos pasos.
"""

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

# Texto de una sección: entre 20 y 6000 letras.
ReportText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=20, max_length=6000)
]
# Texto corto: entre 1 y 240 letras.
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
# Nombre de una zona: entre 3 y 160 letras.
GeoScopeText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=160)
]
# Palabra clave de un giro o negocio: entre 2 y 80 letras.
GeoKeyword = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class GeographicScopeInput(BaseModel):
    """Una zona geográfica que la persona quiere consultar para el informe."""

    model_config = ConfigDict(extra="forbid")

    query: GeoScopeText  # El nombre de la zona, por ejemplo "Toluca".
    # Coordenadas opcionales: latitud entre -90 y 90, longitud entre -180 y 180.
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    # Radio de búsqueda en metros: entre 100 y 5000. Por defecto, 1000 (1 km).
    radius_m: int = Field(default=1000, ge=100, le=5000)
    # Giro o negocio que se busca en esa zona. Opcional.
    keyword: GeoKeyword | None = None

    @model_validator(mode="after")
    def validate_coordinates(self) -> "GeographicScopeInput":
        """Revisa que la latitud y la longitud vengan juntas, o que no venga ninguna."""
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Indica ambas coordenadas o deja ambas vacías.")
        return self


class ReportCreate(BaseModel):
    """Lo que manda la persona al pedir un informe: las zonas a consultar, si quiere."""

    model_config = ConfigDict(extra="forbid")

    # Hasta 3 zonas. Por defecto, ninguna.
    geographic_scopes: list[GeographicScopeInput] = Field(default_factory=list, max_length=3)

    @field_validator("geographic_scopes")
    @classmethod
    def deduplicate_scopes(cls, scopes: list[GeographicScopeInput]) -> list[GeographicScopeInput]:
        """Quita zonas repetidas y limpia los espacios del nombre."""
        unique: dict[tuple[str, float | None, float | None], GeographicScopeInput] = {}
        for scope in scopes:
            # Une los espacios repetidos del nombre: "Toluca   centro" queda "Toluca centro".
            normalized = " ".join(scope.query.split())
            # setdefault: si la zona ya estaba, se conserva la primera.
            unique.setdefault(
                (normalized, scope.latitude, scope.longitude),
                scope.model_copy(update={"query": normalized}),
            )
        return list(unique.values())


class InvestmentEstimate(BaseModel):
    """Una estimación de inversión en pesos mexicanos, con su base y sus supuestos."""

    model_config = ConfigDict(extra="forbid")

    minimum_mxn: int = Field(ge=0, le=100_000_000)  # Mínimo estimado, en pesos.
    maximum_mxn: int = Field(ge=0, le=100_000_000)  # Máximo estimado, en pesos.
    basis: ReportText  # En qué se basa la estimación.
    assumptions: list[ShortText] = Field(min_length=1, max_length=6)  # Supuestos (al menos uno).
    evidence_refs: list[ShortText] = Field(default_factory=list, max_length=8)  # Referencias.

    @model_validator(mode="after")
    def validate_range(self) -> "InvestmentEstimate":
        """Revisa que el mínimo no sea mayor que el máximo."""
        if self.minimum_mxn > self.maximum_mxn:
            raise ValueError("El mínimo de inversión no puede superar el máximo.")
        return self


class ZoneRecommendation(BaseModel):
    """Una zona recomendada (o revisada) para la idea."""

    model_config = ConfigDict(extra="forbid")

    name: ShortText  # Nombre de la zona.
    reason: ReportText  # Por qué se recomienda.
    # Lugares de referencia.
    place_refs: list[ShortText] = Field(default_factory=list, max_length=8)
    caveat: ShortText  # Advertencia sobre lo que no prueba el mapa.


class BusinessVerdict(BaseModel):
    """El veredicto final: qué recomendar, con qué confianza, y los siguientes pasos."""

    model_config = ConfigDict(extra="forbid")

    # Recomendación: probar, validar más, no avanzar todavía, o información insuficiente.
    recommendation: Literal[
        "worth_testing", "needs_validation", "do_not_proceed_yet", "insufficient_information"
    ]
    # Qué tan segura es la recomendación.
    confidence: Literal["low", "medium", "high"]
    summary: ReportText  # El resumen ejecutivo.
    investment: InvestmentEstimate | None = None  # La inversión estimada; opcional.
    zones: list[ZoneRecommendation] = Field(default_factory=list, max_length=4)  # Hasta 4 zonas.
    missing_information: list[ShortText] = Field(default_factory=list, max_length=8)  # Faltantes.
    next_steps: list[ShortText] = Field(min_length=1, max_length=5)  # De 1 a 5 pasos.


class ReportDraft(BaseModel):
    """Lo que devuelve la IA al redactar el informe: el veredicto y las ocho secciones de texto."""

    model_config = ConfigDict(extra="forbid")

    executive_summary: BusinessVerdict  # El veredicto.
    idea_overview: ReportText  # La idea y su propuesta.
    market: ReportText  # Mercado y clientes.
    competition: ReportText  # Competencia y alternativas.
    opportunities: ReportText  # Oportunidades.
    risks: ReportText  # Riesgos.
    hypotheses: ReportText  # Hipótesis por validar.
    missing_information: ReportText  # Información pendiente.
    conclusions: ReportText  # Conclusiones y próximos pasos.


class VerdictInvestmentRead(BaseModel):
    """La inversión estimada tal como la recibe el frontend."""

    minimum_mxn: int
    maximum_mxn: int
    basis: str
    assumptions: list[str]
    evidence_refs: list[str]


class VerdictZoneRead(BaseModel):
    """Una zona del veredicto tal como la recibe el frontend."""

    name: str
    reason: str
    place_refs: list[str]
    caveat: str


class BusinessVerdictRead(BaseModel):
    """El veredicto tal como lo recibe el frontend."""

    recommendation: Literal[
        "worth_testing", "needs_validation", "do_not_proceed_yet", "insufficient_information"
    ]
    confidence: Literal["low", "medium", "high"]
    summary: str
    investment: VerdictInvestmentRead | None = None  # Vacío si no hay estimación.
    zones: list[VerdictZoneRead]
    missing_information: list[str]
    next_steps: list[str]


class ReportSectionRead(BaseModel):
    """Una sección del informe tal como la recibe el frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador de la sección.
    section_type: ReportSectionType  # Qué tipo de sección es.
    position: int  # Orden dentro del informe.
    title: str  # Título que se muestra.
    content: str  # El texto en Markdown.
    verdict: BusinessVerdictRead | None = None  # Solo la sección del veredicto lo trae.


class ReportRead(BaseModel):
    """Los datos generales de un informe, sin sus secciones."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador del informe.
    project_id: uuid.UUID  # Proyecto al que pertenece.
    run_id: uuid.UUID | None  # Investigación de origen; vacío si se borró.
    version: int  # Número de versión.
    title: str  # Título del informe.
    status: ReportStatus  # En qué va: generando, completado o fallido.
    ai_provider: AIProviderName  # Proveedor de IA que lo generó.
    ai_model: str  # Modelo que lo generó.
    error_code: str | None  # Código de error si falló; vacío si no.
    created_at: datetime  # Cuándo se pidió.
    completed_at: datetime | None  # Cuándo terminó; vacío mientras no termine.


class ReportDetail(ReportRead):
    """El informe completo: sus datos generales y sus secciones."""

    sections: list[ReportSectionRead] = Field(default_factory=list)


class ReportListItem(ReportRead):
    """Un informe en la lista del proyecto: sus datos y cuántas secciones tiene."""

    section_count: int = 0


# Títulos en español de cada sección, tal como aparecen en el informe.
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
