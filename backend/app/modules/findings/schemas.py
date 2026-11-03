"""Valida contratos de entrada/salida. Area: resultados/evidencia.

ARCHIVO: backend/app/modules/findings/schemas.py

¿Qué es?
Las "fichas" de los resultados: cómo se ve un hallazgo cuando sale hacia el frontend, qué datos
debe traer la persona para crear uno, y qué campos puede cambiar.

¿Para qué sirve?
Para validar lo que llega y lo que sale. Si la persona manda un texto vacío o un nivel de
confianza que no existe, se rechaza antes de guardarse.

¿Quién lo usa?
router.py (entrada y salida de cada endpoint) y service.py.

Campos opcionales: los que tienen "| None" pueden venir vacíos (null). Los que tienen un valor
por defecto (por ejemplo "= Level.UNDETERMINED") se llenan solos si no se mandan.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.enums import Level, Origin, ResearchCategory, ReviewStatus
from app.core.schemas import PatchModel
from app.modules.entities.models import EntityType
from app.modules.findings.models import EvidenceStance
from app.modules.research.models import SourceType

# El texto de un hallazgo: sin espacios sobrantes, entre 1 y 2000 caracteres.
Statement = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
# La justificación de la confianza: sin espacios sobrantes, hasta 2000 caracteres.
# Puede estar vacía.
Rationale = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class EvidenceSourceRead(BaseModel):
    """La fuente de donde sale una evidencia, tal como la ve el frontend."""

    id: uuid.UUID  # Identificador de la fuente.
    url: str  # Dirección de la página.
    domain: str  # Dominio (por ejemplo "ejemplo.com").
    title: str | None  # Título de la página; vacío si no se conoce.
    source_type: SourceType  # Tipo de fuente (noticias, gobierno, etc.).


class FindingEvidenceRead(BaseModel):
    """Una evidencia que respalda o contradice un hallazgo."""

    evidence_id: uuid.UUID  # Identificador de la evidencia.
    stance: EvidenceStance  # Si apoya (SUPPORTS) o contradice (CONTRADICTS) el hallazgo.
    content: str  # El fragmento de texto citado.
    source: EvidenceSourceRead  # De qué fuente sale el fragmento.


class FindingEntityRead(BaseModel):
    """Una empresa u organización que se menciona en un hallazgo."""

    id: uuid.UUID  # Identificador de la entidad.
    name: str  # Nombre de la empresa u organización.
    entity_type: EntityType  # Tipo: empresa, institución, etc.


class FindingRead(BaseModel):
    """Un hallazgo completo, tal como lo recibe el frontend."""

    # from_attributes permite armar este dato directamente desde el objeto de la base de datos.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador del hallazgo.
    run_id: uuid.UUID | None  # La investigación de donde salió; vacío si lo escribió la persona.
    origin: Origin  # Quién lo creó: la IA (ai) o la persona (user).
    review_status: ReviewStatus  # Estado de revisión: propuesto, aceptado o rechazado.
    finding_type: ResearchCategory  # Tema del hallazgo (mercado, clientes, etc.).
    statement: str  # El texto del hallazgo.
    confidence_level: Level  # Qué tan seguro es: bajo, medio, alto o indeterminado.
    confidence_rationale: str | None  # Por qué ese nivel de confianza; vacío si no hay.
    created_at: datetime  # Cuándo se creó.
    updated_at: datetime  # Cuándo se modificó por última vez.
    # Listas vacías por defecto: si el hallazgo no tiene evidencias o entidades, llegan como [].
    evidence: list[FindingEvidenceRead] = []
    entities: list[FindingEntityRead] = []


class EvidenceLink(BaseModel):
    """Un vínculo que la persona agrega al crear un hallazgo: qué evidencia lo respalda."""

    # "extra=forbid" rechaza campos que no existen, para detectar errores al escribir.
    model_config = ConfigDict(extra="forbid")

    evidence_id: uuid.UUID  # La evidencia que se vincula.
    # Por defecto, la evidencia apoya el hallazgo.
    stance: EvidenceStance = EvidenceStance.SUPPORTS


class FindingCreate(BaseModel):
    """Un hallazgo que escribe la persona.

    Sus evidencias son opcionales, porque es un dato propio.
    """

    model_config = ConfigDict(extra="forbid")

    finding_type: ResearchCategory  # Obligatorio: el tema del hallazgo.
    statement: Statement  # Obligatorio: el texto del hallazgo.
    # Si no se indica, la confianza es "indeterminada".
    confidence_level: Level = Level.UNDETERMINED
    confidence_rationale: Rationale | None = None  # Opcional.
    # Lista de evidencias que lo respaldan. Máximo 20; por defecto vacía.
    evidence: list[EvidenceLink] = Field(default_factory=list, max_length=20)
    # Lista de entidades (empresas) relacionadas. Máximo 20; por defecto vacía.
    entity_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class FindingUpdate(PatchModel):
    """Los campos que se pueden cambiar de un hallazgo. Todos son opcionales (PATCH)."""

    review_status: ReviewStatus | None = None
    finding_type: ResearchCategory | None = None
    statement: Statement | None = None
    confidence_level: Level | None = None
    confidence_rationale: Rationale | None = None
