"""Registro de todos los modelos para que Alembic vea el metadata completo."""

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
