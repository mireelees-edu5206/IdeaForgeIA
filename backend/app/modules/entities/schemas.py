"""Valida contratos de entrada/salida. Area: entidades.

ARCHIVO: backend/app/modules/entities/schemas.py

¿Qué es?
Las "fichas" de empresas y competidores para entrar y salir de la API:
- EntityRead: una empresa, con cuántos hallazgos la mencionan y si ya es competidora.
- CompetitorRead: un competidor, con su empresa, su tipo y su amenaza.
- CompetitorCreate: lo que manda la persona para agregar un competidor.
- CompetitorUpdate: lo que se puede cambiar de un competidor.

¿Para qué sirve?
Para validar los datos. Por ejemplo, un competidor debe apuntar a una
empresa existente o tener el nombre
de una nueva, pero no las dos cosas. Y un sitio web debe ser una dirección http o https válida.

¿Quién lo usa?
router.py y service.py.

Campos opcionales: los que tienen "| None" pueden venir vacíos (null).
"""

import uuid
from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator, model_validator

from app.core.enums import Level, Origin, ReviewStatus
from app.core.schemas import PatchModel
from app.modules.entities.models import CompetitorType, EntityType
from app.modules.research.urls import normalize_url

# Nombre de una entidad: sin espacios sobrantes, entre 1 y 200 letras.
EntityName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# Texto largo opcional: hasta 2000 letras.
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class EntityBrief(BaseModel):
    """Los datos básicos de una empresa."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador de la entidad.
    entity_type: EntityType  # Qué clase de entidad es.
    name: str  # Nombre.
    website: str | None  # Sitio web; vacío si no se conoce.
    description: str | None  # Descripción; vacía si no se conoce.


class EntityRead(EntityBrief):
    """Una empresa con cuántos hallazgos la mencionan y si ya es competidora."""

    finding_count: int  # Cuántos hallazgos la mencionan.
    competitor_id: uuid.UUID | None  # El id del competidor, si ya lo es; vacío si no.


class CompetitorRead(BaseModel):
    """Un competidor tal como lo recibe el frontend."""

    id: uuid.UUID  # Identificador del competidor.
    entity: EntityBrief  # La empresa que es competidora.
    competitor_type: CompetitorType  # Qué tan parecida es a la idea.
    threat_level: Level  # Qué tan fuerte parece.
    rationale: str | None  # Justificación del análisis; vacía si no hay.
    origin: Origin  # Si lo propuso la IA o lo agregó la persona.
    review_status: ReviewStatus  # Propuesto, aceptado o rechazado.
    run_id: uuid.UUID | None  # De qué investigación salió; vacío si lo agregó la persona.
    finding_count: int  # Cuántos hallazgos mencionan a esta empresa.
    created_at: datetime  # Cuándo se creó.
    updated_at: datetime  # Cuándo se modificó por última vez.


class CompetitorCreate(BaseModel):
    """Un competidor que agrega la persona: sobre una empresa existente o una nueva por nombre."""

    # "extra=forbid" rechaza campos que no existen en esta ficha.
    model_config = ConfigDict(extra="forbid")

    # Debe venir entity_id (empresa existente) o name (empresa nueva), pero no las dos.
    entity_id: uuid.UUID | None = None
    name: EntityName | None = None
    entity_type: EntityType = EntityType.COMPANY  # Por defecto, empresa.
    website: str | None = None  # Sitio web; se valida más abajo.
    description: LongText | None = None  # Descripción opcional.
    competitor_type: CompetitorType  # Obligatorio: qué tan parecida es.
    threat_level: Level = Level.UNDETERMINED  # Por defecto, indeterminado.
    rationale: LongText | None = None  # Por qué compite; opcional.

    @field_validator("website")
    @classmethod
    def valid_website(cls, value: str | None) -> str | None:
        """Revisa que el sitio web sea una dirección http o https válida, y la deja en forma
        estándar."""
        if value is None or not value.strip():
            return None
        normalized = normalize_url(value)
        if normalized is None:
            raise ValueError("El sitio web debe ser una URL http(s) válida.")
        return normalized.canonical

    @model_validator(mode="after")
    def entity_or_name(self) -> Self:
        """Revisa que venga una entidad existente o un nombre nuevo, pero solo uno de los dos."""
        if (self.entity_id is None) == (self.name is None):
            raise ValueError("Indica una entidad existente o el nombre de una nueva, no ambos.")
        return self


class CompetitorUpdate(PatchModel):
    """Los campos de un competidor que se pueden cambiar. Todos son opcionales."""

    competitor_type: CompetitorType | None = None
    threat_level: Level | None = None
    rationale: LongText | None = None
    review_status: ReviewStatus | None = None
