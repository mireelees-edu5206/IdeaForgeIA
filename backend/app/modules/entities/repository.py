import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.entities.models import Competitor, Entity, EntityType
from app.modules.findings.models import FindingEntity


class EntityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(
        self,
        project_id: uuid.UUID,
        entity_type: EntityType,
        name: str,
        normalized_name: str,
        website: str | None,
        description: str | None,
    ) -> uuid.UUID:
        """Una entidad por (proyecto, tipo, nombre normalizado); completa los datos que falten."""
        stmt = insert(Entity).values(
            project_id=project_id,
            entity_type=entity_type,
            name=name[:200],
            normalized_name=normalized_name,
            website=website,
            description=description,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Entity.project_id, Entity.entity_type, Entity.normalized_name],
            set_={
                "website": func.coalesce(Entity.website, stmt.excluded.website),
                "description": func.coalesce(Entity.description, stmt.excluded.description),
            },
        ).returning(Entity.id)
        return (await self.session.execute(stmt)).scalar_one()

    async def get(self, project_id: uuid.UUID, entity_id: uuid.UUID) -> Entity | None:
        return await self.session.scalar(
            select(Entity).where(Entity.id == entity_id, Entity.project_id == project_id)
        )

    async def list_with_counts(
        self, project_id: uuid.UUID
    ) -> list[tuple[Entity, int, Competitor | None]]:
        findings = (
            select(func.count()).where(FindingEntity.entity_id == Entity.id).scalar_subquery()
        )
        rows = await self.session.execute(
            select(Entity, findings, Competitor)
            .outerjoin(Competitor, Competitor.entity_id == Entity.id)
            .where(Entity.project_id == project_id)
            .order_by(findings.desc(), Entity.name)
        )
        return list(rows.tuples())

    async def ids_in_project(self, project_id: uuid.UUID, ids: set[uuid.UUID]) -> set[uuid.UUID]:
        if not ids:
            return set()
        found = await self.session.scalars(
            select(Entity.id).where(Entity.project_id == project_id, Entity.id.in_(ids))
        )
        return set(found)


class CompetitorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_project(self, project_id: uuid.UUID) -> list[tuple[Competitor, Entity, int]]:
        findings = (
            select(func.count())
            .where(FindingEntity.entity_id == Competitor.entity_id)
            .scalar_subquery()
        )
        rows = await self.session.execute(
            select(Competitor, Entity, findings)
            .join(Entity, Entity.id == Competitor.entity_id)
            .where(Competitor.project_id == project_id)
            .order_by(Competitor.competitor_type, Entity.name)
        )
        return list(rows.tuples())

    async def get(self, project_id: uuid.UUID, competitor_id: uuid.UUID) -> Competitor | None:
        return await self.session.scalar(
            select(Competitor).where(
                Competitor.id == competitor_id, Competitor.project_id == project_id
            )
        )

    async def get_by_entity(self, project_id: uuid.UUID, entity_id: uuid.UUID) -> Competitor | None:
        return await self.session.scalar(
            select(Competitor).where(
                Competitor.project_id == project_id, Competitor.entity_id == entity_id
            )
        )

    def add(self, competitor: Competitor) -> None:
        self.session.add(competitor)

    async def delete(self, competitor: Competitor) -> None:
        await self.session.delete(competitor)
