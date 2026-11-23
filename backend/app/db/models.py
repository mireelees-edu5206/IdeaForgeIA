"""Importa todos los modelos ORM para que Alembic vea el esquema completo. Area: aplicacion.

ARCHIVO: backend/app/db/models.py

¿Qué es?
Un archivo de registro: importa cada clase de modelo de los módulos de dominio y las expone en
`__all__`. No define tablas nuevas.

¿Para qué sirve?
SQLAlchemy solo conoce las tablas que se han importado. Si un modelo no aparece aquí, Alembic no lo
incluye en `autogenerate`, y `tests/db/test_schema.py` no lo compararía con las migraciones.

¿Quién lo usa?
`alembic/env.py` (para `target_metadata`) y las pruebas de esquema.

Importante: al agregar un modelo nuevo, debe importarse aquí y agregarse a `__all__`.
"""

from app.modules.ai.models import AIApiLog
from app.modules.analysis.models import (
    HypothesisFinding,
    MissingInformation,
    Opportunity,
    OpportunityFinding,
    Risk,
    RiskFinding,
    ValidationHypothesis,
)
from app.modules.auth.models import RefreshToken
from app.modules.entities.models import Competitor, Entity, EntityAlias
from app.modules.findings.models import Evidence, Finding, FindingEntity, FindingEvidence
from app.modules.projects.models import IdeaAttribute, Project
from app.modules.reports.models import Report, ReportSection
from app.modules.research.models import ResearchQuery, ResearchQuerySource, ResearchRun, Source
from app.modules.users.models import User

__all__ = [
    "AIApiLog",
    "Competitor",
    "Entity",
    "EntityAlias",
    "Evidence",
    "Finding",
    "FindingEntity",
    "FindingEvidence",
    "HypothesisFinding",
    "IdeaAttribute",
    "MissingInformation",
    "Opportunity",
    "OpportunityFinding",
    "Project",
    "RefreshToken",
    "Report",
    "ReportSection",
    "ResearchQuery",
    "ResearchQuerySource",
    "ResearchRun",
    "Risk",
    "RiskFinding",
    "Source",
    "User",
    "ValidationHypothesis",
]
