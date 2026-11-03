"""Aplica reglas de negocio y permisos. Area: entidades.

ARCHIVO: backend/app/modules/entities/service.py

¿Qué es?
Las reglas de la competencia: cómo se agrega un competidor, cómo se revisa lo que propuso la IA y
qué se puede borrar.

¿Para qué sirve?
Para que la lista de competidores tenga sentido: una empresa no puede ser
competidora dos veces, y lo
que propuso la IA no se borra sin dejar rastro.

¿Quién lo usa?
router.py (cada endpoint de competencia llama a un método de EntityService).

Reglas principales:
- Un competidor se agrega sobre una empresa existente o una nueva por nombre, pero no sobre las dos.
- Una empresa solo puede ser competidora una vez por proyecto (409 si ya lo es).
- Cambiar la clasificación de un competidor propuesto por la IA lo convierte en dato de la persona.
- Los competidores propuestos por la IA no se borran: solo se rechazan.
"""

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Origin, ReviewStatus
from app.core.errors import AppError, ConflictError, NotFoundError
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

# Campos que cuentan como contenido: cambiarlos convierte una propuesta de la IA en dato de la
# persona.
_CONTENT_FIELDS = ("competitor_type", "threat_level", "rationale")


class EntityNotFoundError(NotFoundError):
    """La empresa no existe en ese proyecto. Responde 404."""

    code = "entity_not_found"
    message = "La entidad no existe."


class CompetitorNotFoundError(NotFoundError):
    """El competidor no existe en ese proyecto. Responde 404."""

    code = "competitor_not_found"
    message = "El competidor no existe."


class CompetitorExistsError(ConflictError):
    """La empresa ya es competidora en el proyecto. Responde 409."""

    code = "competitor_exists"
    message = "Esta entidad ya figura como competidor."


def _competitor_read(competitor: Competitor, entity: Entity, finding_count: int) -> CompetitorRead:
    """Arma la ficha de salida de un competidor, con su empresa y su número de hallazgos."""
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
    """Reglas de negocio de la competencia para cada petición de la API."""

    def __init__(self, session: AsyncSession) -> None:
        """Crea los repositorios de entidades y competidores con la misma sesión."""
        self.session = session
        self.entities = EntityRepository(session)
        self.competitors = CompetitorRepository(session)

    async def list_entities(self, user: User, project_id: uuid.UUID) -> list[EntityRead]:
        """Lista las empresas del proyecto, con sus hallazgos y si ya son competidoras."""
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
        """Lista los competidores del proyecto."""
        project = await get_owned_project(self.session, user, project_id)
        return [
            _competitor_read(c, e, n)
            for c, e, n in await self.competitors.list_for_project(project.id)
        ]

    async def _read_one(self, competitor: Competitor) -> CompetitorRead:
        """Vuelve a leer un competidor ya guardado, para devolverlo con todos sus datos."""
        rows = await self.competitors.list_for_project(competitor.project_id)
        return next(_competitor_read(c, e, n) for c, e, n in rows if c.id == competitor.id)

    async def create_competitor(
        self, user: User, project_id: uuid.UUID, data: CompetitorCreate
    ) -> CompetitorRead:
        """Agrega un competidor. Si el nombre es nuevo, primero crea la empresa."""
        project = await get_owned_project(self.session, user, project_id)
        if data.entity_id is not None:
            # Se usa una empresa que ya existe en el proyecto.
            entity = await self.entities.get(project.id, data.entity_id)
            if entity is None:
                raise EntityNotFoundError()
            entity_id = entity.id
        else:
            if data.name is None:
                raise AppError("Indica el nombre de la entidad.", code="invalid_competitor")
            # Si la empresa ya existía con ese nombre, se reutiliza; si no, se crea.
            entity_id = await self.entities.upsert(
                project.id,
                data.entity_type,
                data.name,
                normalize_entity_name(data.name),
                data.website,
                data.description or None,
            )
        # Una empresa solo puede ser competidora una vez en el proyecto.
        if await self.competitors.get_by_entity(project.id, entity_id) is not None:
            raise CompetitorExistsError()
        # Lo que agrega la persona queda aceptado desde el inicio.
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
            # Si otra petición agregó esa misma empresa al mismo tiempo, se rechaza esta.
            await self.session.rollback()
            raise CompetitorExistsError() from exc
        return await self._read_one(competitor)

    async def _get(self, user: User, project_id: uuid.UUID, competitor_id: uuid.UUID) -> Competitor:
        """Busca un competidor del proyecto del usuario. Si no existe, responde 404."""
        project = await get_owned_project(self.session, user, project_id)
        competitor = await self.competitors.get(project.id, competitor_id)
        if competitor is None:
            raise CompetitorNotFoundError()
        return competitor

    async def update_competitor(
        self, user: User, project_id: uuid.UUID, competitor_id: uuid.UUID, data: CompetitorUpdate
    ) -> CompetitorRead:
        """Cambia tipo, amenaza, justificación o revisión de un competidor."""
        competitor = await self._get(user, project_id, competitor_id)
        changes = data.model_dump(exclude_unset=True)
        content = {k: v for k, v in changes.items() if k in _CONTENT_FIELDS}
        if any(getattr(competitor, k) != v for k, v in content.items()):
            for field, value in content.items():
                # Una justificación vacía se guarda como nulo.
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
        """Quita un competidor propio. Los de la IA no se borran: se rechazan."""
        competitor = await self._get(user, project_id, competitor_id)
        if competitor.origin != Origin.USER:
            raise ConflictError(
                "Los competidores propuestos por la IA no se borran; recházalo en su lugar.",
                code="ai_item_not_deletable",
            )
        await self.competitors.delete(competitor)
        await self.session.commit()
