"""Agrupa consultas SQL del dominio. Area: investigacion web.

ARCHIVO: backend/app/modules/research/repository.py

¿Qué es?
La capa que habla directamente con la base de datos para la investigación. Cada función es una
pregunta concreta, por ejemplo "¿hay una investigación activa?" o "dame las fuentes del proyecto".

¿Para qué sirve?
Para que service.py y orchestrator.py no tengan que escribir SQL. Si una consulta cambia, solo se
toca aquí.

¿Quién lo usa?
service.py (las pantallas), orchestrator.py (la investigación en segundo plano).

Hay tres repositorios:
- ResearchRunRepository: las investigaciones.
- ResearchQueryRepository: las preguntas, sus fuentes y sus evidencias.
- SourceRepository: las fuentes del proyecto.
"""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.findings.models import Evidence
from app.modules.projects.models import Project
from app.modules.research.models import (
    ACTIVE_RUN_STATUSES,
    ResearchQuery,
    ResearchQuerySource,
    ResearchRun,
    Source,
    SourceType,
)
from app.modules.research.urls import NormalizedUrl


class ResearchRunRepository:
    """Consultas sobre las investigaciones (research_runs)."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def has_active(self, project_id: uuid.UUID) -> bool:
        """Indica si el proyecto tiene una investigación pendiente o corriendo."""
        # EXISTS pregunta "¿hay al menos una fila?" y responde solo verdadero o falso.
        return bool(
            await self.session.scalar(
                select(
                    select(ResearchRun.id)
                    .where(
                        ResearchRun.project_id == project_id,
                        ResearchRun.status.in_(ACTIVE_RUN_STATUSES),
                    )
                    .exists()
                )
            )
        )

    async def count_for_user_since(self, user_id: uuid.UUID, since: datetime) -> int:
        """Cuenta cuántas investigaciones creó el usuario desde una fecha. Se usa para el límite
        diario."""
        count = await self.session.scalar(
            select(func.count())
            .select_from(ResearchRun)
            .join(Project, Project.id == ResearchRun.project_id)
            .where(Project.user_id == user_id, ResearchRun.created_at >= since)
        )
        # Si no hay ninguna fila, count viene vacío; se devuelve 0.
        return count or 0

    async def list_for_project(self, project_id: uuid.UUID) -> list[ResearchRun]:
        """Lista las investigaciones del proyecto, de la más nueva a la más vieja."""
        runs = await self.session.scalars(
            select(ResearchRun)
            .where(ResearchRun.project_id == project_id)
            .order_by(ResearchRun.created_at.desc(), ResearchRun.id.desc())
        )
        return list(runs)

    async def get(self, project_id: uuid.UUID, run_id: uuid.UUID) -> ResearchRun | None:
        """Busca una investigación por id, solo si pertenece a ese proyecto. Si no, devuelve
        None."""
        return await self.session.scalar(
            select(ResearchRun).where(
                ResearchRun.id == run_id, ResearchRun.project_id == project_id
            )
        )

    async def list_active(self) -> list[ResearchRun]:
        """Lista todas las investigaciones pendientes o corriendo, de todos los proyectos."""
        runs = await self.session.scalars(
            select(ResearchRun).where(ResearchRun.status.in_(ACTIVE_RUN_STATUSES))
        )
        return list(runs)

    def add(self, run: ResearchRun) -> None:
        """Agrega una investigación a la sesión. Todavía no se guarda hasta el commit."""
        self.session.add(run)


class ResearchQueryRepository:
    """Consultas sobre las preguntas, sus fuentes y sus evidencias."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def list_for_run(self, run_id: uuid.UUID) -> list[ResearchQuery]:
        """Lista las preguntas de una investigación, en el orden en que se planearon."""
        queries = await self.session.scalars(
            select(ResearchQuery)
            .where(ResearchQuery.run_id == run_id)
            .order_by(ResearchQuery.position)
        )
        return list(queries)

    async def sources_for_queries(
        self, query_ids: list[uuid.UUID]
    ) -> list[tuple[ResearchQuerySource, Source]]:
        """Trae las fuentes de varias preguntas a la vez.

        Devuelve pares (vínculo, fuente). Se ordenan por posición en los resultados, y las que
        no tienen posición van al final.
        """
        rows = await self.session.execute(
            select(ResearchQuerySource, Source)
            .join(Source, Source.id == ResearchQuerySource.source_id)
            .where(ResearchQuerySource.query_id.in_(query_ids))
            .order_by(ResearchQuerySource.rank.asc().nulls_last())
        )
        return list(rows.tuples())

    async def evidence_for_queries(self, query_ids: list[uuid.UUID]) -> list[Evidence]:
        """Trae las evidencias (fragmentos citados) de varias preguntas, ordenadas por posición
        en el texto."""
        evidence = await self.session.scalars(
            select(Evidence)
            .where(Evidence.query_id.in_(query_ids))
            .order_by(Evidence.span_start, Evidence.id)
        )
        return list(evidence)


class SourceRepository:
    """Consultas sobre las fuentes (sources) del proyecto."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def upsert(
        self,
        project_id: uuid.UUID,
        url: NormalizedUrl,
        title: str | None,
        source_type: SourceType,
    ) -> uuid.UUID:
        """Guarda una fuente, o la reutiliza si ya existe en el proyecto. Devuelve su id.

        "upsert" significa: inserta si no existe, y si ya existe, actualiza. Aquí, si la fuente
        ya estaba y no tenía título, le pone el nuevo. Si ya tenía título, lo conserva.
        """
        stmt = insert(Source).values(
            project_id=project_id,
            url=url.url,
            canonical_url=url.canonical,
            domain=url.domain[:255],
            title=title,
            source_type=source_type,
        )
        # Si ya existe (misma dirección canónica en el proyecto), solo se completa el título.
        # "coalesce" usa el título guardado si existe; si no, el nuevo.
        stmt = stmt.on_conflict_do_update(
            index_elements=[Source.project_id, Source.canonical_url],
            set_={"title": func.coalesce(Source.title, stmt.excluded.title)},
        ).returning(Source.id)
        return (await self.session.execute(stmt)).scalar_one()

    async def list_with_counts(self, project_id: uuid.UUID) -> list[tuple[Source, int, int]]:
        """Lista las fuentes del proyecto con dos números.

        Esos números son cuántas veces se citaron y cuántas evidencias tienen.

        Las más citadas aparecen primero.
        """
        # Cuenta las preguntas que citaron esta fuente (was_cited = verdadero).
        citations = (
            select(func.count())
            .where(
                ResearchQuerySource.source_id == Source.id,
                ResearchQuerySource.was_cited.is_(True),
            )
            .scalar_subquery()
        )
        # Cuenta cuántas evidencias apuntan a esta fuente.
        evidence = select(func.count()).where(Evidence.source_id == Source.id).scalar_subquery()
        rows = await self.session.execute(
            select(Source, citations, evidence)
            .where(Source.project_id == project_id)
            .order_by(citations.desc(), Source.created_at, Source.id)
        )
        return list(rows.tuples())
