"""Los cuatro tipos de análisis comparten comportamiento; aquí se declara lo que los distingue.

ARCHIVO: backend/app/modules/analysis/kinds.py

¿Qué es?
Una tabla de configuración. Las cuatro partes del análisis (oportunidades, riesgos, hipótesis e
información faltante) hacen casi lo mismo: crear, cambiar y borrar. Este archivo describe en qué
se diferencia cada una: su modelo de base de datos, sus esquemas, su nombre en la URL y qué campos
se consideran contenido.

¿Para qué sirve?
Para no repetir el mismo código cuatro veces. El router y el servicio leen esta tabla y saben qué
hacer con cada tipo.

¿Quién lo usa?
router.py (crea las rutas de cada tipo), service.py (aplica las reglas) y las pruebas.

Conceptos clave:
- content_fields: si la persona cambia alguno de estos campos en una propuesta de la IA,
  la propuesta pasa a ser dato del usuario.
- tracking_fields: campos de seguimiento (por ejemplo, el estado de una hipótesis). Cambiarlos no
  cambia quién la creó.
- link_model: la tabla que une cada elemento con los hallazgos que lo respaldan.
  Información faltante no tiene tabla de unión, porque es justo lo que NO se encontró.
"""

from dataclasses import dataclass

from pydantic import BaseModel

from app.db.base import Base
from app.modules.analysis import schemas as s
from app.modules.analysis.models import (
    HypothesisFinding,
    MissingInformation,
    Opportunity,
    OpportunityFinding,
    Risk,
    RiskFinding,
    ValidationHypothesis,
)


@dataclass(frozen=True, slots=True)
class AnalysisKind:
    """Describe un tipo de análisis: su modelo, sus esquemas y sus campos."""

    key: str  # segmento de la URL, por ejemplo "opportunities" o "missing-information"
    label: str  # para mensajes: "La oportunidad no existe."
    model: type[Base]  # la tabla principal de este tipo
    link_model: type[Base] | None  # tabla intermedia con hallazgos; vacía si no aplica
    link_fk: str | None  # nombre de la columna que apunta al elemento dentro de la tabla intermedia
    read: type[s.AnalysisItemRead]  # esquema de salida
    create: type[BaseModel]  # esquema de entrada para crear
    update: type[BaseModel]  # esquema de entrada para cambiar
    # Cambiarlos convierte una propuesta de la IA en un dato del usuario.
    content_fields: tuple[str, ...]
    # Seguimiento del usuario: no altera la procedencia.
    tracking_fields: tuple[str, ...] = ()


# Oportunidades: qué ventaja podría tener la idea.
OPPORTUNITIES = AnalysisKind(
    key="opportunities",
    label="La oportunidad",
    model=Opportunity,
    link_model=OpportunityFinding,
    link_fk="opportunity_id",
    read=s.OpportunityRead,
    create=s.OpportunityCreate,
    update=s.OpportunityUpdate,
    content_fields=("title", "description", "potential"),
)
# Riesgos: qué podría salir mal.
RISKS = AnalysisKind(
    key="risks",
    label="El riesgo",
    model=Risk,
    link_model=RiskFinding,
    link_fk="risk_id",
    read=s.RiskRead,
    create=s.RiskCreate,
    update=s.RiskUpdate,
    content_fields=("title", "description", "category", "likelihood", "impact", "mitigation"),
)
# Hipótesis: lo que hay que comprobar, con cómo hacerlo y qué se consideraría éxito.
HYPOTHESES = AnalysisKind(
    key="hypotheses",
    label="La hipótesis",
    model=ValidationHypothesis,
    link_model=HypothesisFinding,
    link_fk="hypothesis_id",
    read=s.HypothesisRead,
    create=s.HypothesisCreate,
    update=s.HypothesisUpdate,
    content_fields=(
        "statement",
        "related_attribute",
        "validation_method",
        "success_criteria",
        "priority",
    ),
    # El estado de validación y las notas los cambia el usuario al probar la hipótesis.
    tracking_fields=("validation_status", "result_notes"),
)
# El esquema no tiene tabla intermedia para la información faltante (es lo que NO se encontró).
MISSING_INFORMATION = AnalysisKind(
    key="missing-information",
    label="La información faltante",
    model=MissingInformation,
    link_model=None,
    link_fk=None,
    read=s.MissingInfoRead,
    create=s.MissingInfoCreate,
    update=s.MissingInfoUpdate,
    content_fields=("question", "reason", "related_attribute", "priority"),
    tracking_fields=("resolution_status", "resolution_notes"),
)

# Los cuatro tipos juntos, en el orden en que se muestran y se registran las rutas.
KINDS = (OPPORTUNITIES, RISKS, HYPOTHESES, MISSING_INFORMATION)
# Campos de texto opcionales: una cadena vacía se guarda como NULL.
NULLABLE_TEXT = {
    "mitigation",
    "validation_method",
    "success_criteria",
    "result_notes",
    "reason",
    "resolution_notes",
}
