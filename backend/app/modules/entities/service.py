import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Origin, ReviewStatus
from app.core.errors import ConflictError, NotFoundError
from app.modules.entities.models import Competitor, Entity
from app.modules.entities.normalize import normalize_entity_name
from app.modules.entities.repository import CompetitorRepository, EntityRepository
from app.modules.entities.schemas import (
    CompetitorCreate,
    CompetitorRead,
    CompetitorUpdate,
    EntityBrief,
    EntityRead,
)
from app.modules.projects.service import get_owned_project
from app.modules.users.models import User

_CONTENT_FIELDS = ("competitor_type", "threat_level", "rationale")


class EntityNotFoundError(NotFoundError):
    code = "entity_not_found"
    message = "La entidad no existe."


class CompetitorNotFoundError(NotFoundError):
    code = "competitor_not_found"
    message = "El competidor no existe."


class CompetitorExistsError(ConflictError):
    code = "competitor_exists"
    message = "Esta entidad ya figura como competidor."


def _competitor_read(competitor: Competitor, entity: Entity, finding_count: int) -> CompetitorRead:
    return CompetitorRead(
        id=competitor.id,
        entity=EntityBrief.model_validate(entity),
        competitor_type=competitor.competitor_type,
        threat_level=competitor.threat_level,
        rationale=competitor.rationale,
        origin=competitor.origin,
        review_status=competitor.review_status,
        run_id=competitor.run_id,
        finding_count=finding_count,
        created_at=competitor.created_at,
        updated_at=competitor.updated_at,
    )


class EntityService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.entities = EntityRepository(session)
        self.competitors = CompetitorRepository(session)

    async def list_entities(self, user: User, project_id: uuid.UUID) -> list[EntityRead]:
        project = await get_owned_project(self.session, user, project_id)
        return [
            EntityRead(
                **EntityBrief.model_validate(entity).model_dump(),
                finding_count=count,
                competitor_id=competitor.id if competitor else None,
            )
            for entity, count, competitor in await self.entities.list_with_counts(project.id)
        ]

    async def list_competitors(self, user: User, project_id: uuid.UUID) -> list[CompetitorRead]:
        project = await get_owned_project(self.session, user, project_id)
        return [
            _competitor_read(c, e, n)
            for c, e, n in await self.competitors.list_for_project(project.id)
        ]

    async def _read_one(self, competitor: Competitor) -> CompetitorRead:
        rows = await self.competitors.list_for_project(competitor.project_id)
        return next(_competitor_read(c, e, n) for c, e, n in rows if c.id == competitor.id)

    async def create_competitor(
        self, user: User, project_id: uuid.UUID, data: CompetitorCreate
    ) -> CompetitorRead:
        project = await get_owned_project(self.session, user, project_id)
        if data.entity_id is not None:
            entity = await self.entities.get(project.id, data.entity_id)
            if entity is None:
                raise EntityNotFoundError()
            entity_id = entity.id
        else:
            assert data.name is not None
            entity_id = await self.entities.upsert(
                project.id,
                data.entity_type,
                data.name,
                normalize_entity_name(data.name),
                data.website,
                data.description or None,
            )
        if await self.competitors.get_by_entity(project.id, entity_id) is not None:
            raise CompetitorExistsError()
        competitor = Competitor(
            project_id=project.id,
            entity_id=entity_id,
            origin=Origin.USER,
            review_status=ReviewStatus.ACCEPTED,
            competitor_type=data.competitor_type,
            threat_level=data.threat_level,
            rationale=data.rationale or None,
        )
        self.competitors.add(competitor)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # alta simultánea sobre la misma entidad
            await self.session.rollback()
            raise CompetitorExistsError() from exc
        return await self._read_one(competitor)

    async def _get(self, user: User, project_id: uuid.UUID, competitor_id: uuid.UUID) -> Competitor:
        project = await get_owned_project(self.session, user, project_id)
        competitor = await self.competitors.get(project.id, competitor_id)
        if competitor is None:
            raise CompetitorNotFoundError()
        return competitor

    async def update_competitor(
        self, user: User, project_id: uuid.UUID, competitor_id: uuid.UUID, data: CompetitorUpdate
    ) -> CompetitorRead:
        competitor = await self._get(user, project_id, competitor_id)
        changes = data.model_dump(exclude_unset=True)
        content = {k: v for k, v in changes.items() if k in _CONTENT_FIELDS}
        if any(getattr(competitor, k) != v for k, v in content.items()):
            for field, value in content.items():
                setattr(competitor, field, (value or None) if field == "rationale" else value)
            # Reclasificarlo es un análisis del usuario: deja de ser una propuesta de la IA.
            competitor.origin = Origin.USER
            competitor.review_status = ReviewStatus.ACCEPTED
        if "review_status" in changes:
            competitor.review_status = changes["review_status"]
        await self.session.commit()
        return await self._read_one(competitor)

    async def delete_competitor(
        self, user: User, project_id: uuid.UUID, competitor_id: uuid.UUID
    ) -> None:
        competitor = await self._get(user, project_id, competitor_id)
        if competitor.origin != Origin.USER:
            raise ConflictError(
                "Los competidores propuestos por la IA no se borran; recházalo en su lugar.",
                code="ai_item_not_deletable",
            )
        await self.competitors.delete(competitor)
        await self.session.commit()
