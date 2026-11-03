"""Valida contratos de entrada/salida. Area: analisis.

ARCHIVO: backend/app/modules/analysis/schemas.py

¿Qué es?
Las "fichas" del análisis, para entrar y salir de la API:
- Entrada (Create): lo que hay que mandar para crear un elemento.
  Lleva la lista de hallazgos que lo respaldan.
- Entrada (Update): lo que se puede cambiar. Todos los campos son opcionales.
- Salida (Read): lo que el frontend recibe.
- AnalysisRead: el análisis completo del proyecto, con sus cuatro listas.

¿Para qué sirve?
Para validar los datos. Por ejemplo: un título no puede tener más de 200 letras, y un riesgo debe
tener una categoría válida.

¿Quién lo usa?
router.py y kinds.py (que decide qué esquema usa cada tipo).

Campos opcionales: los que tienen "| None" pueden venir vacíos (null).
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import AttributeType, Level, Origin, Priority, ResearchCategory, ReviewStatus
from app.core.schemas import PatchModel
from app.modules.analysis.models import ResolutionStatus, RiskCategory, ValidationStatus

# Título: sin espacios sobrantes, entre 1 y 200 caracteres.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# Texto obligatorio: entre 1 y 4000 caracteres.
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
# Texto opcional: hasta 4000 caracteres, puede estar vacío.
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
# Lista de ids de hallazgos que respaldan el elemento. Máximo 20; por defecto vacía.
FindingIds = Annotated[list[uuid.UUID], Field(default_factory=list, max_length=20)]


class FindingBrief(BaseModel):
    """Un resumen corto de un hallazgo que respalda un elemento del análisis."""

    id: uuid.UUID  # Identificador del hallazgo.
    finding_type: ResearchCategory  # Tema del hallazgo.
    statement: str  # Su texto.
    confidence_level: Level  # Qué tan seguro es.
    review_status: ReviewStatus  # Si está propuesto, aceptado o rechazado.


class AnalysisItemRead(BaseModel):
    """Campos comunes que tienen todos los elementos del análisis al salir hacia el frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador del elemento.
    run_id: uuid.UUID | None  # De qué investigación salió; vacío si lo creó la persona.
    origin: Origin  # Quién lo creó: la IA o la persona.
    review_status: ReviewStatus  # Estado de revisión.
    created_at: datetime  # Cuándo se creó.
    updated_at: datetime  # Cuándo se modificó por última vez.
    # Hallazgos que lo respaldan. Lista vacía si no tiene ninguno.
    findings: list[FindingBrief] = []


# ─────────────── Oportunidades ───────────────


class OpportunityFields(BaseModel):
    """Los campos de una oportunidad que la persona puede escribir."""

    # "extra=forbid" rechaza campos que no existen en el esquema.
    model_config = ConfigDict(extra="forbid")

    title: Title  # Obligatorio.
    description: Text  # Obligatorio.
    potential: Level = Level.UNDETERMINED  # Si no se indica, indeterminado.


class OpportunityCreate(OpportunityFields):
    """Lo que hay que mandar para crear una oportunidad."""

    finding_ids: FindingIds  # Hallazgos que la respaldan. Puede ser lista vacía.


class OpportunityUpdate(PatchModel):
    """Los campos de una oportunidad que se pueden cambiar. Todos son opcionales."""

    title: Title | None = None
    description: Text | None = None
    potential: Level | None = None
    review_status: ReviewStatus | None = None


class OpportunityRead(AnalysisItemRead):
    """Una oportunidad tal como la recibe el frontend."""

    title: str
    description: str
    potential: Level


# ─────────────── Riesgos ───────────────


class RiskFields(BaseModel):
    """Los campos de un riesgo que la persona puede escribir."""

    model_config = ConfigDict(extra="forbid")

    title: Title  # Obligatorio.
    description: Text  # Obligatorio.
    category: RiskCategory = RiskCategory.OTHER  # Si no se indica, "otro".
    likelihood: Level = Level.UNDETERMINED  # Qué tan probable es.
    impact: Level = Level.UNDETERMINED  # Qué tanto daño haría.
    mitigation: OptionalText | None = None  # Cómo reducirlo. Opcional.


class RiskCreate(RiskFields):
    """Lo que hay que mandar para crear un riesgo."""

    finding_ids: FindingIds  # Hallazgos que lo respaldan.


class RiskUpdate(PatchModel):
    """Los campos de un riesgo que se pueden cambiar. Todos son opcionales."""

    title: Title | None = None
    description: Text | None = None
    category: RiskCategory | None = None
    likelihood: Level | None = None
    impact: Level | None = None
    mitigation: OptionalText | None = None
    review_status: ReviewStatus | None = None


class RiskRead(AnalysisItemRead):
    """Un riesgo tal como lo recibe el frontend."""

    title: str
    description: str
    category: RiskCategory
    likelihood: Level
    impact: Level
    mitigation: str | None


# ─────────────── Hipótesis de validación ───────────────


class HypothesisFields(BaseModel):
    """Los campos de una hipótesis que la persona puede escribir."""

    model_config = ConfigDict(extra="forbid")

    statement: Text  # La afirmación a comprobar. Obligatoria.
    related_attribute: AttributeType | None = None  # Qué parte de la idea toca. Opcional.
    validation_method: OptionalText | None = None  # Cómo comprobarla. Opcional.
    success_criteria: OptionalText | None = None  # Qué la confirmaría. Opcional.
    priority: Priority = Priority.MEDIUM  # Por defecto, media.


class HypothesisCreate(HypothesisFields):
    """Lo que hay que mandar para crear una hipótesis."""

    finding_ids: FindingIds  # Hallazgos que la respaldan.


class HypothesisUpdate(PatchModel):
    """Los campos de una hipótesis que se pueden cambiar. Todos son opcionales."""

    statement: Text | None = None
    related_attribute: AttributeType | None = None
    validation_method: OptionalText | None = None
    success_criteria: OptionalText | None = None
    priority: Priority | None = None
    review_status: ReviewStatus | None = None
    # Seguimiento: no cambia la procedencia.
    validation_status: ValidationStatus | None = None
    result_notes: OptionalText | None = None


class HypothesisRead(AnalysisItemRead):
    """Una hipótesis tal como la recibe el frontend."""

    statement: str
    related_attribute: AttributeType | None
    validation_method: str | None
    success_criteria: str | None
    priority: Priority
    validation_status: ValidationStatus
    result_notes: str | None


# ─────────────── Información faltante ───────────────


class MissingInfoFields(BaseModel):
    """Los campos de una pregunta sin respuesta que la persona puede escribir."""

    model_config = ConfigDict(extra="forbid")

    question: Text  # La pregunta. Obligatoria.
    reason: OptionalText | None = None  # Por qué no se respondió. Opcional.
    related_attribute: AttributeType | None = None  # Qué parte de la idea toca. Opcional.
    priority: Priority = Priority.MEDIUM  # Por defecto, media.


class MissingInfoCreate(MissingInfoFields):
    """Sin hallazgos vinculados: el esquema no tiene tabla intermedia para lo que falta."""


class MissingInfoUpdate(PatchModel):
    """Los campos de una pregunta sin respuesta que se pueden cambiar. Todos son opcionales."""

    question: Text | None = None
    reason: OptionalText | None = None
    related_attribute: AttributeType | None = None
    priority: Priority | None = None
    review_status: ReviewStatus | None = None
    resolution_status: ResolutionStatus | None = None
    resolution_notes: OptionalText | None = None


class MissingInfoRead(AnalysisItemRead):
    """Una pregunta sin respuesta tal como la recibe el frontend."""

    question: str
    reason: str | None
    related_attribute: AttributeType | None
    priority: Priority
    resolution_status: ResolutionStatus
    resolution_notes: str | None


class AnalysisRead(BaseModel):
    """El análisis completo del proyecto: las cuatro listas juntas."""

    opportunities: list[OpportunityRead]  # Oportunidades.
    risks: list[RiskRead]  # Riesgos.
    hypotheses: list[HypothesisRead]  # Hipótesis.
    missing_information: list[MissingInfoRead]  # Información faltante.
