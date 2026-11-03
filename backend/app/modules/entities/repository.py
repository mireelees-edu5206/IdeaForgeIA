"""Agrupa consultas SQL del dominio. Area: entidades.

ARCHIVO: backend/app/modules/entities/repository.py

¿Qué es?
La capa que habla con la base de datos para entidades y competidores. Cada función responde una
pregunta concreta, por ejemplo "dame las entidades con cuántos hallazgos las mencionan".

¿Para qué sirve?
Para que service.py no tenga SQL mezclado con las reglas de negocio.

¿Quién lo usa?
service.py (las pantallas de competencia) y findings/extraction.py (guarda lo que propone la IA).

Hay dos repositorios:
- EntityRepository: las entidades (empresas, productos, etc.).
- CompetitorRepository: los competidores.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.entities.models import Competitor, Entity, EntityType
from app.modules.findings.models import FindingEntity


class EntityRepository:
    """Consultas sobre las entidades."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
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
        """Guarda la entidad, o la reutiliza si ya existe en el proyecto. Devuelve su id.

        Una entidad es única por proyecto, tipo y nombre normalizado. Si ya existía y le falta sitio
        web o descripción, se completan con los datos nuevos.
        """
        stmt = insert(Entity).values(
            project_id=project_id,
            entity_type=entity_type,
            name=name[:200],
            normalized_name=normalized_name,
            website=website,
            description=description,
        )
        # Si ya existe, solo se rellena lo que estaba vacío (coalesce usa el dato guardado si
        # existe).
        stmt = stmt.on_conflict_do_update(
            index_elements=[Entity.project_id, Entity.entity_type, Entity.normalized_name],
            set_={
                "website": func.coalesce(Entity.website, stmt.excluded.website),
                "description": func.coalesce(Entity.description, stmt.excluded.description),
            },
        ).returning(Entity.id)
        return (await self.session.execute(stmt)).scalar_one()

    async def get(self, project_id: uuid.UUID, entity_id: uuid.UUID) -> Entity | None:
        """Busca una entidad por id, solo si pertenece al proyecto. Si no, devuelve None."""
        return await self.session.scalar(
            select(Entity).where(Entity.id == entity_id, Entity.project_id == project_id)
        )

    async def list_with_counts(
        self, project_id: uuid.UUID
    ) -> list[tuple[Entity, int, Competitor | None]]:
        """Lista las entidades del proyecto con cuántos hallazgos las mencionan.

        Cada fila trae también el competidor, si la entidad ya es competidora.
        Las que más aparecen van primero.
        """
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
        """Devuelve cuáles de esos ids de entidad existen en el proyecto. Sirve para validar."""
        if not ids:
            return set()
        found = await self.session.scalars(
            select(Entity.id).where(Entity.project_id == project_id, Entity.id.in_(ids))
        )
        return set(found)


class CompetitorRepository:
    """Consultas sobre los competidores."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def list_for_project(self, project_id: uuid.UUID) -> list[tuple[Competitor, Entity, int]]:
        """Lista los competidores del proyecto con su entidad y cuántos hallazgos la mencionan.

        Se ordenan por tipo de competidor y luego por nombre.
        """
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
        """Busca un competidor por id, solo si pertenece al proyecto. Si no, devuelve None."""
        return await self.session.scalar(
            select(Competitor).where(
                Competitor.id == competitor_id, Competitor.project_id == project_id
            )
        )

    async def get_by_entity(self, project_id: uuid.UUID, entity_id: uuid.UUID) -> Competitor | None:
        """Busca si una entidad ya es competidora en el proyecto. Si no, devuelve None."""
        return await self.session.scalar(
            select(Competitor).where(
                Competitor.project_id == project_id, Competitor.entity_id == entity_id
            )
        )

    def add(self, competitor: Competitor) -> None:
        """Agrega un competidor a la sesión. Todavía no se guarda hasta el commit."""
        self.session.add(competitor)

    async def delete(self, competitor: Competitor) -> None:
        """Marca el competidor para borrarlo. Se borra de verdad en el commit."""
        await self.session.delete(competitor)
