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
    code = "report_not_found"


class ReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def start(
        self,
        user: User,
        project_id: uuid.UUID,
        provider: AIProvider,
        geographic_scopes: list[GeographicScopeInput] | None = None,
    ) -> ReportRead:
        project = await get_owned_project(self.session, user, project_id)
        await self.session.scalar(
            select(Project.id).where(Project.id == project.id).with_for_update()
        )

        if project.status != ProjectStatus.ANALYZED:
            raise ConflictError(
                "Completa la investigación y el análisis antes de generar el informe.",
                code="project_not_analyzed",
            )

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

        pending = await self.session.scalar(
            select(Report.id).where(
                Report.project_id == project.id,
                Report.status == ReportStatus.GENERATING,
            )
        )
        if pending is not None:
            raise ConflictError("Ya se está generando un informe.", code="report_in_progress")

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
        await self.session.refresh(report)
        return ReportRead.model_validate(report)

    async def list_for_project(self, user: User, project_id: uuid.UUID) -> list[ReportListItem]:
        project = await get_owned_project(self.session, user, project_id)
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
        report = await self.session.get(Report, report_id)
        if report is None or report.status != ReportStatus.GENERATING:
            return
        report.status = ReportStatus.FAILED
        report.error_code = error_code
        report.completed_at = datetime.now(UTC)
        await self.session.commit()
