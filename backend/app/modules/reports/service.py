"""Aplica reglas de negocio y permisos. Area: informes/veredicto.

ARCHIVO: backend/app/modules/reports/service.py

¿Qué es?
Las reglas del informe final cuando la persona lo pide o lo consulta. Decide cuándo se puede
generar un informe, le asigna su número de versión, y arma las respuestas para el frontend.

¿Para qué sirve?
Para que el informe solo se genere cuando el proyecto ya tiene investigación y análisis terminados,
y para que nunca haya dos informes generándose a la vez.

¿Quién lo usa?
router.py (cada endpoint de informes llama a un método de ReportService).

Reglas principales:
- El proyecto debe estar analizado (ANALYZED). Si no, responde conflicto.
- Debe existir una investigación completada.
- Solo puede haber un informe generándose por proyecto.
- Si no se mandan zonas, se toman las zonas geográficas que la persona confirmó
  en su idea (máximo 3).
- Cada informe nuevo recibe la siguiente versión (1, 2, 3...).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AttributeType
from app.core.errors import ConflictError, NotFoundError
from app.modules.ai.providers.base import AIProvider
from app.modules.projects.models import Project, ProjectStatus
from app.modules.projects.repository import IdeaAttributeRepository
from app.modules.projects.service import get_owned_project
from app.modules.reports.models import Report, ReportSection, ReportStatus
from app.modules.reports.schemas import (
    GeographicScopeInput,
    ReportDetail,
    ReportListItem,
    ReportRead,
    ReportSectionRead,
)
from app.modules.research.models import ResearchRun, RunStatus
from app.modules.users.models import User


class ReportNotFoundError(NotFoundError):
    """El informe no existe en ese proyecto. Responde 404."""

    code = "report_not_found"


class ReportService:
    """Reglas de negocio de los informes para cada petición de la API."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos de esta petición."""
        self.session = session

    async def start(
        self,
        user: User,
        project_id: uuid.UUID,
        provider: AIProvider,
        geographic_scopes: list[GeographicScopeInput] | None = None,
    ) -> ReportRead:
        """Crea el informe en estado "generando". El router lo genera después en segundo plano.

        Antes de crearlo bloquea el proyecto con "with_for_update", para que dos peticiones al mismo
        tiempo no creen dos informes con la misma versión.
        """
        project = await get_owned_project(self.session, user, project_id)
        # Bloquea la fila del proyecto mientras se revisa y se crea el informe.
        await self.session.scalar(
            select(Project.id).where(Project.id == project.id).with_for_update()
        )

        # El informe solo tiene sentido cuando la idea ya está analizada.
        if project.status != ProjectStatus.ANALYZED:
            raise ConflictError(
                "Completa la investigación y el análisis antes de generar el informe.",
                code="project_not_analyzed",
            )

        # Se toma la investigación completada más reciente.
        run = await self.session.scalar(
            select(ResearchRun)
            .where(ResearchRun.project_id == project.id, ResearchRun.status == RunStatus.COMPLETED)
            .order_by(ResearchRun.created_at.desc(), ResearchRun.id.desc())
            .limit(1)
        )
        if run is None:
            raise ConflictError(
                "No hay una investigación completada para documentar.",
                code="completed_research_required",
            )

        # Si no se mandaron zonas, se usan las zonas geográficas que la persona confirmó en su idea.
        if geographic_scopes is None:
            attributes = await IdeaAttributeRepository(self.session).list_for_project(project.id)
            geographic_scopes_data = [
                {"query": attribute.value.strip()}
                for attribute in attributes
                if attribute.attribute_type == AttributeType.GEOGRAPHIC_SCOPE
                and attribute.is_confirmed
            ][:3]
        else:
            geographic_scopes_data = [
                scope.model_dump(exclude_none=True) for scope in geographic_scopes
            ]

        # Si ya hay un informe generándose, no se crea otro.
        pending = await self.session.scalar(
            select(Report.id).where(
                Report.project_id == project.id,
                Report.status == ReportStatus.GENERATING,
            )
        )
        if pending is not None:
            raise ConflictError("Ya se está generando un informe.", code="report_in_progress")

        # La nueva versión es la más alta que exista, más uno. Si no hay informes, es la 1.
        version = (
            await self.session.scalar(
                select(func.max(Report.version)).where(Report.project_id == project.id)
            )
            or 0
        ) + 1
        report = Report(
            project_id=project.id,
            run_id=run.id,
            version=version,
            title=f"Veredicto final: {project.title}",
            geographic_scopes=geographic_scopes_data,
            status=ReportStatus.GENERATING,
            ai_provider=provider.name,
            ai_model=provider.model,
        )
        self.session.add(report)
        await self.session.commit()
        # refresh vuelve a leer el informe de la base, para tener su id y sus valores finales.
        await self.session.refresh(report)
        return ReportRead.model_validate(report)

    async def list_for_project(self, user: User, project_id: uuid.UUID) -> list[ReportListItem]:
        """Lista los informes del proyecto, del más reciente al más antiguo.

        Cada uno incluye su número de secciones.
        """
        project = await get_owned_project(self.session, user, project_id)
        # Una sola consulta: cada informe con la cuenta de sus secciones (0 si no tiene).
        rows = await self.session.execute(
            select(Report, func.count(ReportSection.id))
            .outerjoin(ReportSection, ReportSection.report_id == Report.id)
            .where(Report.project_id == project.id)
            .group_by(Report.id)
            .order_by(Report.version.desc())
        )
        return [
            ReportListItem.model_validate(report).model_copy(
                update={"section_count": section_count}
            )
            for report, section_count in rows.tuples()
        ]

    async def get(self, user: User, project_id: uuid.UUID, report_id: uuid.UUID) -> ReportDetail:
        """Devuelve un informe completo con sus secciones, en su orden."""
        project = await get_owned_project(self.session, user, project_id)
        report = await self.session.scalar(
            select(Report).where(Report.id == report_id, Report.project_id == project.id)
        )
        if report is None:
            raise ReportNotFoundError()
        sections = await self.session.scalars(
            select(ReportSection)
            .where(ReportSection.report_id == report.id)
            .order_by(ReportSection.position)
        )
        return ReportDetail(
            **ReportRead.model_validate(report).model_dump(),
            sections=[ReportSectionRead.model_validate(section) for section in sections],
        )

    async def fail(self, report_id: uuid.UUID, error_code: str) -> None:
        """Marca un informe como fallido, solo si todavía se estaba generando."""
        report = await self.session.get(Report, report_id)
        if report is None or report.status != ReportStatus.GENERATING:
            return
        report.status = ReportStatus.FAILED
        report.error_code = error_code
        report.completed_at = datetime.now(UTC)
        await self.session.commit()
