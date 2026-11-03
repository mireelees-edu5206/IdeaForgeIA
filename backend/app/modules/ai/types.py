"""Tipos neutrales respecto al proveedor para solicitudes, resultados y consumo de IA.

ARCHIVO: backend/app/modules/ai/types.py

¿Qué es?
Las "cajas" con las que se mueven los datos de la inteligencia artificial dentro del backend.
Son iguales sin importar si la respuesta viene de Gemini, de Ollama o del proveedor de prueba.

¿Para qué sirve?
Para que el resto del sistema no tenga que saber qué proveedor respondió. Cada respuesta llega
en la misma forma: el texto, las fuentes, cuántos tokens se usaron y cuánto tardó.

¿Quién lo usa?
- Los adaptadores de proveedores (providers/) devuelven estas cajas.
- El orquestador (orchestrator.py) las combina y decide qué hacer si un proveedor falla.
- calls.py y models.py las convierten en registros de auditoría (ai_api_logs).

Glosario sencillo:
- "Token": un trozo de texto que la IA lee o escribe. Se cobra y se mide por tokens.
- "Grounding": la IA busca en internet y cita de dónde sacó cada dato.
- "Span" o "fragmento citado": un rango de letras de la respuesta (de dónde a dónde) que
  está respaldado por ciertas fuentes.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

from app.core.enums import AIProviderName


@dataclass(frozen=True, slots=True)
class AIMessage:
    """Un mensaje para la IA: quién lo dice (role) y su texto (content).

    - role "system": las instrucciones generales.
    - role "user": lo que pide la persona o el sistema.
    - role "assistant": una respuesta previa de la IA (para dar contexto).
    """

    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class AIUsage:
    """Cuánto consumió una llamada a la IA.

    - input_tokens: tokens enviados (None si el proveedor no lo informa).
    - output_tokens: tokens recibidos (None si no lo informa).
    - search_queries_count: cuántas búsquedas en internet hizo (0 por defecto).
    - estimated_cost_usd: costo estimado en dólares (None si no se conoce).
    """

    input_tokens: int | None = None
    output_tokens: int | None = None
    search_queries_count: int = 0
    estimated_cost_usd: Decimal | None = None


@dataclass(frozen=True, slots=True)
class AIProviderAttempt:
    """Un intento de llamar a un proveedor, bien o mal.

    Se guarda uno por cada proveedor que se intentó, para la bitácora. Si el primero falla y el
    de respaldo responde, quedan los dos registros.
    """

    provider: AIProviderName
    model: str
    status: Literal["success", "error"]
    latency_ms: int  # Cuántos milisegundos tardó.
    usage: AIUsage = field(default_factory=AIUsage)
    error_code: str | None = None  # Código del error, si falló (por ejemplo "ai_timeout").


@dataclass(frozen=True, slots=True)
class StructuredResult[T]:
    """Respuesta con datos estructurados (JSON validado contra un esquema).

    - data: los datos ya convertidos al tipo T (por ejemplo, un esquema de Pydantic).
    - attempts: la lista de intentos que se hicieron para obtenerla.
    """

    data: T
    usage: AIUsage = field(default_factory=AIUsage)
    provider: AIProviderName | None = None
    model: str | None = None
    attempts: tuple[AIProviderAttempt, ...] = ()


@dataclass(frozen=True, slots=True)
class GroundedSource:
    """Página consultada por el buscador del proveedor.

    - url: la dirección de la página.
    - title: su título, si se conoce.
    - cited: True si el proveedor la marcó como usada en la respuesta.
    """

    url: str
    title: str | None = None
    # El proveedor la marca como citada aunque no indique a qué fragmento respalda.
    cited: bool = False


@dataclass(frozen=True, slots=True)
class CitationSpan:
    """Fragmento de la respuesta [start, end) respaldado por las fuentes indicadas.

    - start y end: posiciones de letras dentro del texto. "end" no se incluye.
    - source_indexes: los números de las fuentes que respaldan ese fragmento.
    """

    start: int
    end: int
    source_indexes: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class GroundedResult:
    """Respuesta de texto basada en búsquedas en internet, con sus fuentes y citas.

    - text: el texto de la respuesta.
    - sources: las páginas que se consultaron.
    - citations: qué parte del texto está respaldada por qué fuentes.
    - executed_queries: las búsquedas que hizo la IA en internet.
    - search_suggestions_html: un bloque de sugerencias de búsqueda de Google. Gemini obliga a
      mostrarlo tal cual, por eso se guarda como HTML.
    """

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
