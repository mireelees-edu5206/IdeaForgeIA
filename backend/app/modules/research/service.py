import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ConflictError, NotFoundError, TooManyRequestsError
from app.modules.ai.providers.base import AIProvider
from app.modules.projects.models import Project, ProjectStatus
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.service import ProjectNotFoundError
from app.modules.research.models import ResearchRun
from app.modules.research.repository import (
    ResearchQueryRepository,
    ResearchRunRepository,
    SourceRepository,
)
from app.modules.research.schemas import (
    EvidenceRead,
    QuerySourceRead,
    ResearchQueryRead,
    ResearchRunDetail,
    ResearchRunRead,
    SourceRead,
)
from app.modules.users.models import User

_RESEARCHABLE_STATUSES = (
    ProjectStatus.STRUCTURED,
    ProjectStatus.RESEARCHING,
    ProjectStatus.ANALYZED,
)


class ResearchRunNotFoundError(NotFoundError):
    code = "research_run_not_found"
    message = "La investigación no existe."


class ResearchInProgressError(ConflictError):
    code = "research_in_progress"
    message = "Ya hay una investigación en curso para este proyecto."


class ResearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.projects = ProjectRepository(session)
        self.runs = ResearchRunRepository(session)
        self.queries = ResearchQueryRepository(session)
        self.sources = SourceRepository(session)

    async def _get_owned(self, user: User, project_id: uuid.UUID) -> Project:
        project = await self.projects.get_owned(project_id, user.id)
        if project is None:
            raise ProjectNotFoundError()
        return project

    async def start_run(
        self, user: User, project_id: uuid.UUID, provider: AIProvider, settings: Settings
    ) -> ResearchRunRead:
        """Crea la ejecución en estado pending; el router lanza el orquestador en segundo plano."""
        project = await self._get_owned(user, project_id)
        if project.status not in _RESEARCHABLE_STATUSES:
            raise ConflictError(
                "Confirma la estructura de la idea antes de investigar.",
                code="project_not_structured",
            )
        if await self.runs.has_active(project.id):
            raise ResearchInProgressError()
        since = datetime.now(UTC) - timedelta(days=1)
        if (
            await self.runs.count_for_user_since(user.id, since)
            >= settings.research_max_runs_per_day
        ):
            raise TooManyRequestsError(
                f"Alcanzaste el límite de {settings.research_max_runs_per_day} investigaciones"
                " en 24 horas. Inténtalo más tarde.",
                code="research_limit_reached",
            )
        run = ResearchRun(project_id=project.id, ai_provider=provider.name, ai_model=provider.model)
        self.runs.add(run)
        project.status = ProjectStatus.RESEARCHING
        try:
            await self.session.commit()
        except IntegrityError as exc:  # otra petición simultánea creó la ejecución activa
            await self.session.rollback()
            raise ResearchInProgressError() from exc
        return ResearchRunRead.model_validate(run)

    async def list_runs(self, user: User, project_id: uuid.UUID) -> list[ResearchRunRead]:
        project = await self._get_owned(user, project_id)
        return [
            ResearchRunRead.model_validate(r) for r in await self.runs.list_for_project(project.id)
        ]

    async def get_run(
        self, user: User, project_id: uuid.UUID, run_id: uuid.UUID
    ) -> ResearchRunDetail:
        project = await self._get_owned(user, project_id)
        run = await self.runs.get(project.id, run_id)
        if run is None:
            raise ResearchRunNotFoundError()
        queries = await self.queries.list_for_run(run.id)
        query_ids = [q.id for q in queries]
        sources: dict[uuid.UUID, list[QuerySourceRead]] = defaultdict(list)
        for link, source in await self.queries.sources_for_queries(query_ids):
            sources[link.query_id].append(
                QuerySourceRead(
                    source_id=source.id,
                    url=source.url,
                    domain=source.domain,
                    title=source.title,
                    source_type=source.source_type,
                    was_cited=link.was_cited,
                    rank=link.rank,
                )
            )
        evidence: dict[uuid.UUID, list[EvidenceRead]] = defaultdict(list)
        for item in await self.queries.evidence_for_queries(query_ids):
            if item.query_id is not None:
                evidence[item.query_id].append(EvidenceRead.model_validate(item))
        return ResearchRunDetail(
            **ResearchRunRead.model_validate(run).model_dump(),
            queries=[
                ResearchQueryRead(
                    id=q.id,
                    position=q.position,
                    category=q.category,
                    question=q.question,
                    status=q.status,
                    response_text=q.response_text,
                    executed_queries=q.executed_queries,
                    search_suggestions_html=q.search_suggestions_html,
                    completed_at=q.completed_at,
                    sources=sources[q.id],
                    evidence=evidence[q.id],
                )
                for q in queries
            ],
        )

    async def list_sources(self, user: User, project_id: uuid.UUID) -> list[SourceRead]:
        project = await self._get_owned(user, project_id)
        return [
            SourceRead(
                id=source.id,
                url=source.url,
                domain=source.domain,
                title=source.title,
                source_type=source.source_type,
                created_at=source.created_at,
                citation_count=citations,
                evidence_count=evidence,
            )
            for source, citations, evidence in await self.sources.list_with_counts(project.id)
        ]
