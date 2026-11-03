"""Valida contratos de entrada/salida. Area: asistente contextual.

ARCHIVO: backend/app/modules/chat/schemas.py

¿Qué es?
Las "fichas" del chat:
- ChatRequest: lo que manda el frontend (el mensaje nuevo y el historial de la conversación).
- ChatAnswer: lo que devuelve la IA (el texto y los ids de hallazgos en que se apoya).
- ChatResponse: lo que el backend le responde al frontend, con referencias ya armadas.

¿Para qué sirve?
Para limitar el tamaño de lo que se manda y para que la IA no pueda inventar referencias.

Límites importantes:
- El mensaje nuevo: entre 1 y 2000 letras.
- Cada turno del historial: entre 1 y 3000 letras.
- El historial: máximo 14 turnos.
- Mensaje más historial juntos: máximo 3000 letras. Si pasa, se rechaza.

¿Quién lo usa?
router.py, service.py, prompts.py y fake_responses.py.
"""

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.core.enums import AIProviderName, Level, Origin, ResearchCategory, ReviewStatus

# Mensaje nuevo: sin espacios sobrantes, entre 1 y 2000 letras.
ChatText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
# Un turno del historial: entre 1 y 3000 letras.
ChatHistoryText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)
]


class ChatTurn(BaseModel):
    """Un mensaje de la conversación previa: quién lo dijo y qué dijo."""

    model_config = ConfigDict(extra="forbid")

    # Solo puede ser de la persona ("user") o de la IA ("assistant").
    role: Literal["user", "assistant"]
    content: ChatHistoryText  # El texto del mensaje.


class ChatRequest(BaseModel):
    """Lo que manda el frontend: el mensaje nuevo y la conversación anterior."""

    model_config = ConfigDict(extra="forbid")

    message: ChatText  # La pregunta nueva.
    # Hasta 14 turnos anteriores. Por defecto, ninguno.
    history: list[ChatTurn] = Field(default_factory=list, max_length=14)

    @model_validator(mode="after")
    def limit_conversation_size(self) -> "ChatRequest":
        """Rechaza la petición si el mensaje y el historial juntos pasan de 3000 letras."""
        if len(self.message) + sum(len(turn.content) for turn in self.history) > 3000:
            raise ValueError("La conversación es demasiado larga; inicia una conversación nueva.")
        return self


class ChatAnswer(BaseModel):
    """Lo que devuelve la IA: la respuesta y los hallazgos en que se apoya."""

    model_config = ConfigDict(extra="forbid")

    # La respuesta, sin espacios sobrantes. Debe tener al menos una letra.
    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    # Ids de hallazgos que apoyan la respuesta. Máximo 10; puede ser lista vacía.
    finding_ids: list[uuid.UUID] = Field(default_factory=list, max_length=10)


class ChatEvidenceReference(BaseModel):
    """Una evidencia que se muestra junto a la respuesta, con su fuente."""

    # Si apoya, contradice o solo da contexto.
    stance: Literal["supports", "contradicts", "context"]
    content: str  # El fragmento citado.
    source_url: str | None  # Dirección de la fuente; vacía si no se conoce.
    source_title: str | None  # Título de la fuente; vacío si no se conoce.
    source_domain: str  # Dominio de la fuente.


class ChatFindingReference(BaseModel):
    """Un hallazgo que se muestra como referencia de la respuesta."""

    id: uuid.UUID  # Identificador del hallazgo.
    finding_type: ResearchCategory  # Tema del hallazgo.
    statement: str  # Su texto.
    confidence_level: Level  # Qué tan seguro es.
    origin: Origin  # Si lo creó la IA o la persona.
    review_status: ReviewStatus  # Si está propuesto, aceptado o rechazado.
    evidence: list[ChatEvidenceReference]  # Las evidencias que lo respaldan.


class ChatResponse(BaseModel):
    """Lo que el backend le responde al frontend."""

    answer: str  # La respuesta de la IA.
    references: list[ChatFindingReference]  # Los hallazgos que la respaldan.
    # Qué proveedor y modelo respondieron. Vacíos si no se conocen.
    provider: AIProviderName | None = None
    model: str | None = None
