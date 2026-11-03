"""Valida contratos de entrada/salida. Area: proyectos.

ARCHIVO: backend/app/modules/projects/schemas.py

¿Qué es?
Las "fichas" de proyectos y de las partes de la idea, para entrar y salir de la API:
- Entrada: lo que hay que mandar para crear o cambiar un proyecto o un atributo.
- Salida: lo que el frontend recibe, desde un resumen ligero hasta el detalle completo con la
  revisión de la estructura.

¿Para qué sirve?
Para validar los datos antes de guardarlos. Por ejemplo, la idea debe tener entre 20 y 5000 letras,
y el título no puede estar vacío.

¿Quién lo usa?
router.py, service.py y los demás módulos que leen proyectos.

Campos opcionales: los que tienen "| None" pueden venir vacíos (null).
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.core.enums import AttributeType, Origin
from app.core.schemas import PatchModel
from app.modules.projects.models import (
    ATTRIBUTE_VALUE_MAX_LENGTH,
    RAW_IDEA_MAX_LENGTH,
    RAW_IDEA_MIN_LENGTH,
    ProjectStatus,
)

# Título del proyecto: sin espacios sobrantes, entre 1 y 200 letras.
ProjectTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
# Texto de la idea: sin espacios sobrantes, entre 20 y 5000 letras (los límites vienen de
# models.py).
RawIdea = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=RAW_IDEA_MIN_LENGTH, max_length=RAW_IDEA_MAX_LENGTH
    ),
]
# Valor de una parte de la idea: sin espacios sobrantes, entre 1 y 4000 letras.
AttributeValue = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=ATTRIBUTE_VALUE_MAX_LENGTH),
]


# ─────────────── Proyectos ───────────────


class ProjectCreate(BaseModel):
    """Lo que manda la persona para crear un proyecto: su título y su idea."""

    # "extra=forbid" rechaza cualquier campo que no esté en esta ficha.
    model_config = ConfigDict(extra="forbid")

    title: ProjectTitle  # Obligatorio.
    raw_idea: RawIdea  # Obligatorio.


class ProjectUpdate(PatchModel):
    """Lo que se puede cambiar de un proyecto. Todos los campos son opcionales."""

    title: ProjectTitle | None = None
    raw_idea: RawIdea | None = None


class ProjectSummary(BaseModel):
    """Versión ligera de un proyecto para las listas (sin el texto completo de la idea)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador del proyecto.
    title: str  # Título.
    status: ProjectStatus  # Etapa actual.
    created_at: datetime  # Cuándo se creó.
    updated_at: datetime  # Cuándo se modificó por última vez.


class ProjectRead(ProjectSummary):
    """Un proyecto completo: su resumen más el texto original de la idea."""

    raw_idea: str  # El texto original de la idea.


# ─────────────── Atributos de la idea ───────────────


class IdeaAttributeCreate(BaseModel):
    """Lo que manda la persona para agregar un valor a una parte de la idea."""

    model_config = ConfigDict(extra="forbid")

    attribute_type: AttributeType  # Qué parte de la idea es (problema, solución, etc.).
    value: AttributeValue  # El texto de ese valor.


class IdeaAttributeUpdate(PatchModel):
    """Lo que se puede cambiar de un valor de la idea. Todos los campos son opcionales."""

    value: AttributeValue | None = None  # Nuevo texto.
    is_confirmed: bool | None = None  # Confirmar o desconfirmar el valor.


class IdeaAttributeRead(BaseModel):
    """Un valor de la idea tal como lo recibe el frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador del valor.
    attribute_type: AttributeType  # Qué parte de la idea es.
    value: str  # El texto del valor.
    position: int  # Orden dentro de su tipo (0, 1, 2...).
    origin: Origin  # Quién lo escribió: la persona o la IA.
    is_confirmed: bool  # Si ya fue confirmado.
    created_at: datetime  # Cuándo se creó.
    updated_at: datetime  # Cuándo se modificó por última vez.


class StructureCheck(BaseModel):
    """Qué falta para poder confirmar la estructura de la idea."""

    ready: bool  # True si ya se puede confirmar.
    missing: list[AttributeType]  # atributos obligatorios sin ningún valor confirmado
    pending_suggestions: int  # sugerencias de IA aún sin confirmar


class ProjectDetail(ProjectRead):
    """El proyecto completo: sus datos, sus partes de la idea y el estado de su estructura."""

    attributes: list[IdeaAttributeRead]  # Todas las partes de la idea.
    structure: StructureCheck  # Qué falta para confirmar la estructura.


class ProjectsOverview(BaseModel):
    """Un resumen de todos los proyectos de la persona."""

    total: int  # Cuántos proyectos tiene en total.
    by_status: dict[ProjectStatus, int]  # Cuántos hay en cada etapa.
