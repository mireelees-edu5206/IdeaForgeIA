"""Agrupa consultas SQL del dominio. Area: proyectos."""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AttributeType
from app.modules.projects.models import IdeaAttribute, Project, ProjectStatus

_ATTRIBUTE_ORDER = {attribute_type: index for index, attribute_type in enumerate(AttributeType)}


class ProjectRepository:
    """Repositorio de consultas para proyecto."""

    def __init__(self, session: AsyncSession) -> None:
        """Gestiona la inicializacion para proyectos."""
        self.session = session

    async def get_owned(self, project_id: uuid.UUID, user_id: uuid.UUID) -> Project | None:
        """Solo devuelve el proyecto si pertenece al usuario (autorización por propiedad)."""
        return await self.session.scalar(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        )

    async def list_owned(
        self, user_id: uuid.UUID, status: ProjectStatus | None, limit: int, offset: int
    ) -> tuple[list[Project], int]:
        """Lista propio."""
        conditions = [Project.user_id == user_id]
        # Rama condicional: se cumple status is not None.
        if status is not None:
            conditions.append(Project.status == status)
        total = await self.session.scalar(select(func.count()).where(*conditions))
        items = await self.session.scalars(
            select(Project)
            .where(*conditions)
            .order_by(Project.updated_at.desc(), Project.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(items), total or 0

    async def count_by_status(self, user_id: uuid.UUID) -> dict[ProjectStatus, int]:
        """Cuenta por estado."""
        rows = await self.session.execute(
            select(Project.status, func.count())
            .where(Project.user_id == user_id)
            .group_by(Project.status)
        )
        counts = {status: 0 for status in ProjectStatus}
        counts.update({status: count for status, count in rows.tuples()})
        return counts

    def add(self, project: Project) -> None:
        """Agrega el flujo principal."""
        self.session.add(project)

    async def delete(self, project: Project) -> None:
        """Elimina el proyecto y delega el borrado dependiente a ON DELETE CASCADE."""
        # Las tablas dependientes se borran por ON DELETE CASCADE en la BD.
        await self.session.delete(project)

    async def touch(self, project_id: uuid.UUID) -> None:
        """Actualiza updated_at (el trigger pone now()) para reflejar actividad en el proyecto."""
        await self.session.execute(
            update(Project).where(Project.id == project_id).values(updated_at=func.now())
        )


class IdeaAttributeRepository:
    """Repositorio de consultas para idea atributo."""

    def __init__(self, session: AsyncSession) -> None:
        """Gestiona la inicializacion para proyectos."""
        self.session = session

    async def list_for_project(self, project_id: uuid.UUID) -> list[IdeaAttribute]:
        """Lista para proyecto."""
        attributes = await self.session.scalars(
            select(IdeaAttribute).where(IdeaAttribute.project_id == project_id)
        )
        # Orden del formulario (orden del enum) y, dentro de cada tipo, por posición.
        return sorted(attributes, key=lambda a: (_ATTRIBUTE_ORDER[a.attribute_type], a.position))

    async def get(self, project_id: uuid.UUID, attribute_id: uuid.UUID) -> IdeaAttribute | None:
        """Obtiene el flujo principal."""
        return await self.session.scalar(
            select(IdeaAttribute).where(
                IdeaAttribute.id == attribute_id, IdeaAttribute.project_id == project_id
            )
        )

    async def count_and_next_position(
        self, project_id: uuid.UUID, attribute_type: AttributeType
    ) -> tuple[int, int]:
        """Cuenta and next position."""
        row = (
            await self.session.execute(
                select(func.count(), func.coalesce(func.max(IdeaAttribute.position) + 1, 0)).where(
                    IdeaAttribute.project_id == project_id,
                    IdeaAttribute.attribute_type == attribute_type,
                )
            )
        ).one()
        return row[0], row[1]

    def add(self, attribute: IdeaAttribute) -> None:
        """Agrega el flujo principal."""
        self.session.add(attribute)

    async def delete(self, attribute: IdeaAttribute) -> None:
        """Elimina el flujo principal."""
        await self.session.delete(attribute)
