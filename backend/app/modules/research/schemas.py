"""Valida contratos de entrada/salida. Area: investigacion web.

ARCHIVO: backend/app/modules/research/schemas.py

¿Qué es?
Las "fichas" de datos de la investigación. Hay dos grupos:
1. Salida estructurada de la IA: PlannedQuestion y ResearchPlan. Son lo que la IA debe devolver
   al planear las preguntas. Se validan antes de guardar nada.
2. API: lo que el backend responde al frontend
   (ResearchRunRead, ResearchRunDetail, SourceRead, etc.).

¿Para qué sirve?
Para que cada dato tenga la forma correcta. Si algo no cumple la ficha (por ejemplo, una pregunta
demasiado corta), se rechaza antes de llegar a la base de datos.

¿Quién lo usa?
- router.py (las respuestas de la API).
- orchestrator.py y service.py (los datos de la investigación).
- fake_responses.py (la simulación del plan para pruebas).

Campos opcionales: los que tienen "| None" pueden venir vacíos (null). Los demás son obligatorios.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import AIProviderName, ResearchCategory
from app.modules.research.models import QueryStatus, RunStatus, RunStep, SourceType

# ─────────────── Salida estructurada de la IA ───────────────


class PlannedQuestion(BaseModel):
    """Una pregunta del plan de investigación: a qué tema pertenece y qué se pregunta."""

    # Tema de la pregunta: mercado, clientes, competencia, etc. (ver core/enums.py).
    category: ResearchCategory
    # Texto de la pregunta. Se quitan espacios sobrantes; debe tener entre 10 y 500 caracteres.
    question: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=500)
    ]


class ResearchPlan(BaseModel):
    """Plan de investigación que devuelve la IA (se valida antes de guardarlo)."""

    # Entre 1 y 20 preguntas. Más de 20 se rechaza para que el costo y el tiempo sean razonables.
    questions: list[PlannedQuestion] = Field(min_length=1, max_length=20)


# ─────────────── API ───────────────


class ResearchRunRead(BaseModel):
    """Una investigación tal como la ve el frontend (sin sus consultas)."""

    # from_attributes permite armar este dato directamente desde el objeto de la base de datos.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador de la investigación.
    status: RunStatus  # En qué estado va (pending, running, completed, failed, interrupted...).
    current_step: RunStep | None  # Paso en curso (puede venir vacío si no hay paso activo).
    progress_pct: int  # Avance de 0 a 100.
    ai_provider: AIProviderName  # Qué proveedor de IA se usó.
    ai_model: str  # Qué modelo se usó.
    error_code: str | None  # Código de error si falló; vacío si no.
    error_message: str | None  # Mensaje de error para mostrar; vacío si no.
    started_at: datetime | None  # Cuándo empezó; vacío si aún no empieza.
    finished_at: datetime | None  # Cuándo terminó; vacío si sigue activa.
    created_at: datetime  # Cuándo se creó la investigación.


class QuerySourceRead(BaseModel):
    """Una fuente que se usó para responder una consulta concreta."""

    source_id: uuid.UUID  # Identificador de la fuente.
    url: str  # Dirección de la página.
    domain: str  # Dominio (por ejemplo "ejemplo.com").
    title: str | None  # Título de la página; vacío si no se conoce.
    source_type: SourceType  # Tipo: gobierno, académica, noticias, desconocida, etc.
    was_cited: bool  # True si la IA la usó en la respuesta.
    rank: int | None  # Posición en los resultados; vacío si no se sabe.


class EvidenceRead(BaseModel):
    """Fragmento de la respuesta respaldado por una fuente (cita del proveedor)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador de la evidencia.
    source_id: uuid.UUID  # De qué fuente viene.
    content: str  # El texto citado.
    span_start: int | None  # Posición donde empieza el texto dentro de la respuesta (en letras).
    span_end: int | None  # Posición donde termina (sin incluir esa letra).


class ResearchQueryRead(BaseModel):
    """Una pregunta de la investigación con su respuesta, fuentes y evidencias."""

    id: uuid.UUID  # Identificador de la consulta.
    position: int  # Orden de la pregunta dentro de la investigación (1, 2, 3...).
    category: ResearchCategory  # Tema de la pregunta.
    question: str  # El texto de la pregunta.
    status: QueryStatus  # En qué estado va la consulta (pendiente, completada, fallida...).
    response_text: str | None  # La respuesta de la IA; vacía si todavía no hay.
    executed_queries: list[str]  # Las búsquedas que hizo la IA en internet.
    # El bloque de sugerencias de búsqueda de Google, si lo hay.
    search_suggestions_html: str | None
    completed_at: datetime | None  # Cuándo se completó; vacío si no.
    sources: list[QuerySourceRead]  # Las fuentes usadas para esta pregunta.
    evidence: list[EvidenceRead]  # Los fragmentos citados de esta pregunta.


class ResearchRunDetail(ResearchRunRead):
    """La investigación completa: todos los datos de ResearchRunRead más sus consultas."""

    queries: list[ResearchQueryRead]


class SourceRead(BaseModel):
    """Una fuente única del proyecto, con cuántas veces se usó."""

    id: uuid.UUID  # Identificador de la fuente.
    url: str  # Dirección de la página.
    domain: str  # Dominio.
    title: str | None  # Título; vacío si no se conoce.
    source_type: SourceType  # Tipo de fuente.
    created_at: datetime  # Cuándo se guardó por primera vez.
    citation_count: int  # consultas que la citaron
    evidence_count: int  # Cuántos fragmentos citados tiene.
