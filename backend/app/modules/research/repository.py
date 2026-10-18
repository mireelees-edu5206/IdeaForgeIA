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
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def has_active(self, project_id: uuid.UUID) -> bool:
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
        count = await self.session.scalar(
            select(func.count())
            .select_from(ResearchRun)
            .join(Project, Project.id == ResearchRun.project_id)
            .where(Project.user_id == user_id, ResearchRun.created_at >= since)
        )
        return count or 0

    async def list_for_project(self, project_id: uuid.UUID) -> list[ResearchRun]:
        runs = await self.session.scalars(
            select(ResearchRun)
            .where(ResearchRun.project_id == project_id)
            .order_by(ResearchRun.created_at.desc(), ResearchRun.id.desc())
        )
        return list(runs)

    async def get(self, project_id: uuid.UUID, run_id: uuid.UUID) -> ResearchRun | None:
        return await self.session.scalar(
            select(ResearchRun).where(
                ResearchRun.id == run_id, ResearchRun.project_id == project_id
            )
        )

    async def list_active(self) -> list[ResearchRun]:
        runs = await self.session.scalars(
            select(ResearchRun).where(ResearchRun.status.in_(ACTIVE_RUN_STATUSES))
        )
        return list(runs)

    def add(self, run: ResearchRun) -> None:
        self.session.add(run)


class ResearchQueryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_run(self, run_id: uuid.UUID) -> list[ResearchQuery]:
        queries = await self.session.scalars(
            select(ResearchQuery)
            .where(ResearchQuery.run_id == run_id)
            .order_by(ResearchQuery.position)
        )
        return list(queries)

    async def sources_for_queries(
        self, query_ids: list[uuid.UUID]
    ) -> list[tuple[ResearchQuerySource, Source]]:
        rows = await self.session.execute(
            select(ResearchQuerySource, Source)
            .join(Source, Source.id == ResearchQuerySource.source_id)
            .where(ResearchQuerySource.query_id.in_(query_ids))
            .order_by(ResearchQuerySource.rank.asc().nulls_last())
        )
        return list(rows.tuples())

    async def evidence_for_queries(self, query_ids: list[uuid.UUID]) -> list[Evidence]:
        evidence = await self.session.scalars(
            select(Evidence)
            .where(Evidence.query_id.in_(query_ids))
            .order_by(Evidence.span_start, Evidence.id)
        )
        return list(evidence)


class SourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(
        self,
        project_id: uuid.UUID,
        url: NormalizedUrl,
        title: str | None,
        source_type: SourceType,
    ) -> uuid.UUID:
        """Una fuente por URL canónica y proyecto; completa el título si antes no lo tenía."""
        stmt = insert(Source).values(
            project_id=project_id,
            url=url.url,
            canonical_url=url.canonical,
            domain=url.domain[:255],
            title=title,
            source_type=source_type,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Source.project_id, Source.canonical_url],
            set_={"title": func.coalesce(Source.title, stmt.excluded.title)},
        ).returning(Source.id)
        return (await self.session.execute(stmt)).scalar_one()

    async def list_with_counts(self, project_id: uuid.UUID) -> list[tuple[Source, int, int]]:
        citations = (
            select(func.count())
            .where(
                ResearchQuerySource.source_id == Source.id,
                ResearchQuerySource.was_cited.is_(True),
            )
            .scalar_subquery()
        )
        evidence = select(func.count()).where(Evidence.source_id == Source.id).scalar_subquery()
        rows = await self.session.execute(
            select(Source, citations, evidence)
            .where(Source.project_id == project_id)
            .order_by(citations.desc(), Source.created_at, Source.id)
        )
        return list(rows.tuples())
