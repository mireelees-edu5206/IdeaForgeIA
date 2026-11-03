"""Aplica reglas de negocio y permisos. Area: investigacion web.

ARCHIVO: backend/app/modules/research/service.py

¿Qué es?
El cerebro de la investigación cuando la persona interactúa con ella. Decide si se puede iniciar
una investigación, revisa permisos, arma las respuestas para el frontend
y coordina la base de datos.

¿Para qué sirve?
Para que las reglas estén en un solo lugar: solo se investiga
proyectos con la estructura confirmada,
no se permiten dos investigaciones a la vez, y hay un límite diario por usuario.

¿Quién lo usa?
router.py (cada endpoint llama a un método de ResearchService).

Reglas principales:
- Solo se puede investigar un proyecto en estado "structured", "researching" o "analyzed".
- Un proyecto no puede tener dos investigaciones activas al mismo tiempo (409 research_in_progress).
- Cada usuario tiene un límite diario de investigaciones (RESEARCH_MAX_RUNS_PER_DAY). Si lo pasa,
  responde 429.
- Un proyecto ajeno se trata como si no existiera (404): así no se revela que existe.
"""

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

# Estados del proyecto en los que sí se puede lanzar una investigación.
# Un proyecto en "draft" primero necesita que se confirme su estructura.
_RESEARCHABLE_STATUSES = (
    ProjectStatus.STRUCTURED,
    ProjectStatus.RESEARCHING,
    ProjectStatus.ANALYZED,
)


class ResearchRunNotFoundError(NotFoundError):
    """La investigación pedida no existe en ese proyecto. Responde 404."""

    code = "research_run_not_found"
    message = "La investigación no existe."


class ResearchInProgressError(ConflictError):
    """Ya hay una investigación pendiente o corriendo en el proyecto. Responde 409."""

    code = "research_in_progress"
    message = "Ya hay una investigación en curso para este proyecto."


class ResearchService:
    """Reglas de negocio de la investigación para cada petición de la API."""

    def __init__(self, session: AsyncSession) -> None:
        """Crea los repositorios que el servicio necesita, todos con la misma sesión."""
        self.session = session
        self.projects = ProjectRepository(session)
        self.runs = ResearchRunRepository(session)
        self.queries = ResearchQueryRepository(session)
        self.sources = SourceRepository(session)

    async def _get_owned(self, user: User, project_id: uuid.UUID) -> Project:
        """Devuelve el proyecto si es de esa persona. Si no, lanza "no encontrado"."""
        project = await self.projects.get_owned(project_id, user.id)
        if project is None:
            # Se responde igual si no existe o si es de otro usuario, para no revelar cuál es.
            raise ProjectNotFoundError()
        return project

    async def start_run(
        self, user: User, project_id: uuid.UUID, provider: AIProvider, settings: Settings
    ) -> ResearchRunRead:
        """Crea la investigación en estado pending. Después el router la lanza en segundo plano.

        Revisa, en este orden: que el proyecto sea del usuario, que tenga estructura confirmada,
        que no haya otra investigación activa y que no se pase del límite diario.
        """
        project = await self._get_owned(user, project_id)
        if project.status not in _RESEARCHABLE_STATUSES:
            raise ConflictError(
                "Confirma la estructura de la idea antes de investigar.",
                code="project_not_structured",
            )
        if await self.runs.has_active(project.id):
            raise ResearchInProgressError()
        # Cuenta las investigaciones de las últimas 24 horas para el límite diario.
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
        # La investigación nace con el proveedor y modelo de IA que se usarán.
        run = ResearchRun(project_id=project.id, ai_provider=provider.name, ai_model=provider.model)
        self.runs.add(run)
        # El proyecto pasa a "investigando" mientras la investigación esté activa.
        project.status = ProjectStatus.RESEARCHING
        try:
            await self.session.commit()
        except IntegrityError as exc:  # otra petición simultánea creó la ejecución activa
            # Si otra petición creó una investigación activa justo al mismo tiempo, la base de datos
            # lo
            # detecta. Se deshace lo que se intentó y se responde con conflicto.
            await self.session.rollback()
            raise ResearchInProgressError() from exc
        return ResearchRunRead.model_validate(run)

    async def list_runs(self, user: User, project_id: uuid.UUID) -> list[ResearchRunRead]:
        """Lista las investigaciones del proyecto, si es del usuario."""
        project = await self._get_owned(user, project_id)
        return [
            ResearchRunRead.model_validate(r) for r in await self.runs.list_for_project(project.id)
        ]

    async def get_run(
        self, user: User, project_id: uuid.UUID, run_id: uuid.UUID
    ) -> ResearchRunDetail:
        """Arma el detalle completo de una investigación: preguntas, fuentes y evidencias.

        Hace una consulta por cada tipo de dato (no una por pregunta), y después junta todo
        en memoria. Así no hace muchas idas a la base de datos.
        """
        project = await self._get_owned(user, project_id)
        run = await self.runs.get(project.id, run_id)
        if run is None:
            raise ResearchRunNotFoundError()
        queries = await self.queries.list_for_run(run.id)
        query_ids = [q.id for q in queries]
        # Agrupa las fuentes por pregunta: { id_de_pregunta: [fuente, fuente, ...] }.
        # defaultdict crea la lista vacía la primera vez que se usa una clave.
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
        # Agrupa las evidencias por pregunta, igual que las fuentes.
        evidence: dict[uuid.UUID, list[EvidenceRead]] = defaultdict(list)
        for item in await self.queries.evidence_for_queries(query_ids):
            if item.query_id is not None:
                evidence[item.query_id].append(EvidenceRead.model_validate(item))
        return ResearchRunDetail(
            # "**" copia todos los campos de la investigación base, y después se agregan las
            # preguntas.
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
                    # Si una pregunta no tiene fuentes o evidencias, el diccionario da una lista
                    # vacía.
                    sources=sources[q.id],
                    evidence=evidence[q.id],
                )
                for q in queries
            ],
        )

    async def list_sources(self, user: User, project_id: uuid.UUID) -> list[SourceRead]:
        """Lista las fuentes del proyecto con sus contadores de citas y evidencias."""
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
