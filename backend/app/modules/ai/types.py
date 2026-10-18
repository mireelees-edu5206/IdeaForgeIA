"""Tipos neutrales respecto al proveedor para solicitudes, resultados y consumo de IA."""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

from app.core.enums import AIProviderName


@dataclass(frozen=True, slots=True)
class AIMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class AIUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    search_queries_count: int = 0
    estimated_cost_usd: Decimal | None = None


@dataclass(frozen=True, slots=True)
class AIProviderAttempt:
    provider: AIProviderName
    model: str
    status: Literal["success", "error"]
    latency_ms: int
    usage: AIUsage = field(default_factory=AIUsage)
    error_code: str | None = None


@dataclass(frozen=True, slots=True)
class StructuredResult[T]:
    data: T
    usage: AIUsage = field(default_factory=AIUsage)
    provider: AIProviderName | None = None
    model: str | None = None
    attempts: tuple[AIProviderAttempt, ...] = ()


@dataclass(frozen=True, slots=True)
class GroundedSource:
    """Página consultada por el buscador del proveedor."""

    url: str
    title: str | None = None
    # El proveedor la marca como citada aunque no indique a qué fragmento respalda.
    cited: bool = False


@dataclass(frozen=True, slots=True)
class CitationSpan:
    """Fragmento de la respuesta [start, end) respaldado por las fuentes indicadas."""

    start: int
    end: int
    source_indexes: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class GroundedResult:
    text: str
    sources: list[GroundedSource] = field(default_factory=list)
    citations: list[CitationSpan] = field(default_factory=list)
    executed_queries: list[str] = field(default_factory=list)
    # HTML de Google Search Suggestions (obligatorio mostrarlo con Gemini).
    search_suggestions_html: str | None = None
    usage: AIUsage = field(default_factory=AIUsage)
    provider: AIProviderName | None = None
    model: str | None = None
    attempts: tuple[AIProviderAttempt, ...] = ()
