"""Valida contratos de entrada/salida. Area: proyectos."""

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

ProjectTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
RawIdea = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=RAW_IDEA_MIN_LENGTH, max_length=RAW_IDEA_MAX_LENGTH
    ),
]
AttributeValue = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=ATTRIBUTE_VALUE_MAX_LENGTH),
]


# ─────────────── Proyectos ───────────────


class ProjectCreate(BaseModel):
    """Representa proyecto creacion."""

    model_config = ConfigDict(extra="forbid")

    title: ProjectTitle
    raw_idea: RawIdea


class ProjectUpdate(PatchModel):
    """Representa proyecto actualizacion."""

    title: ProjectTitle | None = None
    raw_idea: RawIdea | None = None


class ProjectSummary(BaseModel):
    """Versión ligera para listados (sin el texto completo de la idea)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class ProjectRead(ProjectSummary):
    """Contrato de datos para proyecto read."""

    raw_idea: str


# ─────────────── Atributos de la idea ───────────────


class IdeaAttributeCreate(BaseModel):
    """Representa idea atributo creacion."""

    model_config = ConfigDict(extra="forbid")

    attribute_type: AttributeType
    value: AttributeValue


class IdeaAttributeUpdate(PatchModel):
    """Representa idea atributo actualizacion."""

    value: AttributeValue | None = None
    is_confirmed: bool | None = None


class IdeaAttributeRead(BaseModel):
    """Contrato de datos para idea atributo read."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attribute_type: AttributeType
    value: str
    position: int
    origin: Origin
    is_confirmed: bool
    created_at: datetime
    updated_at: datetime


class StructureCheck(BaseModel):
    """Qué falta para poder confirmar la estructura de la idea."""

    ready: bool
    missing: list[AttributeType]  # atributos obligatorios sin ningún valor confirmado
    pending_suggestions: int  # sugerencias de IA aún sin confirmar


class ProjectDetail(ProjectRead):
    """Representa proyecto detalle."""

    attributes: list[IdeaAttributeRead]
    structure: StructureCheck


class ProjectsOverview(BaseModel):
    """Representa proyectos overview."""

    total: int
    by_status: dict[ProjectStatus, int]
