"""Agrupa consultas SQL del dominio. Area: proyectos.

ARCHIVO: backend/app/modules/projects/repository.py

¿Qué es?
La capa que habla con la base de datos para proyectos y atributos de la idea. Cada función es una
pregunta concreta, por ejemplo "dame los proyectos de este usuario"
o "cuántos valores tiene este tipo".

¿Para qué sirve?
Para que service.py no tenga SQL mezclado con las reglas de negocio.

¿Quién lo usa?
service.py de proyectos y, para leer los atributos, otros módulos (investigación, informes, chat).

Hay dos repositorios:
- ProjectRepository: los proyectos.
- IdeaAttributeRepository: las partes de la idea.
"""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AttributeType
from app.modules.projects.models import IdeaAttribute, Project, ProjectStatus

# Orden de los tipos de atributo, igual que en el formulario: primero el problema, después la
# solución...
_ATTRIBUTE_ORDER = {attribute_type: index for index, attribute_type in enumerate(AttributeType)}


class ProjectRepository:
    """Consultas sobre los proyectos."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def get_owned(self, project_id: uuid.UUID, user_id: uuid.UUID) -> Project | None:
        """Devuelve el proyecto solo si pertenece al usuario. Si no, devuelve None.

        Esta es la revisión de propiedad: un proyecto ajeno se trata igual que uno que no existe.
        """
        return await self.session.scalar(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        )

    async def list_owned(
        self, user_id: uuid.UUID, status: ProjectStatus | None, limit: int, offset: int
    ) -> tuple[list[Project], int]:
        """Lista los proyectos del usuario, con filtro opcional por etapa y paginación.

        Devuelve la página de proyectos y el total (sin contar la paginación).
        """
        conditions = [Project.user_id == user_id]
        if status is not None:
            conditions.append(Project.status == status)
        total = await self.session.scalar(select(func.count()).where(*conditions))
        items = await self.session.scalars(
            select(Project)
            .where(*conditions)
            # Los proyectos modificados más recientemente aparecen primero.
            .order_by(Project.updated_at.desc(), Project.id.desc())
            # limit y offset cortan la página: "offset" salta los anteriores.
            .limit(limit)
            .offset(offset)
        )
        return list(items), total or 0

    async def count_by_status(self, user_id: uuid.UUID) -> dict[ProjectStatus, int]:
        """Cuenta cuántos proyectos tiene el usuario en cada etapa. Las etapas vacías cuentan 0."""
        rows = await self.session.execute(
            select(Project.status, func.count())
            .where(Project.user_id == user_id)
            .group_by(Project.status)
        )
        # Empieza con todas las etapas en 0, y después se sustituyen las que sí tienen proyectos.
        counts = {status: 0 for status in ProjectStatus}
        counts.update({status: count for status, count in rows.tuples()})
        return counts

    def add(self, project: Project) -> None:
        """Agrega un proyecto a la sesión. Todavía no se guarda hasta el commit."""
        self.session.add(project)

    async def delete(self, project: Project) -> None:
        """Marca el proyecto para borrarlo. Lo dependiente se borra solo por ON DELETE CASCADE."""
        # Las tablas dependientes se borran por ON DELETE CASCADE en la BD.
        await self.session.delete(project)

    async def touch(self, project_id: uuid.UUID) -> None:
        """Actualiza updated_at (el trigger pone now()) para reflejar actividad en el proyecto."""
        await self.session.execute(
            update(Project).where(Project.id == project_id).values(updated_at=func.now())
        )


class IdeaAttributeRepository:
    """Consultas sobre las partes de la idea (atributos)."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def list_for_project(self, project_id: uuid.UUID) -> list[IdeaAttribute]:
        """Lista los atributos del proyecto en el orden del formulario."""
        attributes = await self.session.scalars(
            select(IdeaAttribute).where(IdeaAttribute.project_id == project_id)
        )
        # Orden del formulario (orden del enum) y, dentro de cada tipo, por posición.
        return sorted(attributes, key=lambda a: (_ATTRIBUTE_ORDER[a.attribute_type], a.position))

    async def get(self, project_id: uuid.UUID, attribute_id: uuid.UUID) -> IdeaAttribute | None:
        """Busca un atributo por id, solo si pertenece al proyecto. Si no, devuelve None."""
        return await self.session.scalar(
            select(IdeaAttribute).where(
                IdeaAttribute.id == attribute_id, IdeaAttribute.project_id == project_id
            )
        )

    async def count_and_next_position(
        self, project_id: uuid.UUID, attribute_type: AttributeType
    ) -> tuple[int, int]:
        """Devuelve cuántos valores tiene ese tipo y en qué posición debe ir el siguiente.

        Si no hay valores, la siguiente posición es 0. Si el máximo es 2, la siguiente es 3.
        """
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
        """Agrega un atributo a la sesión. Todavía no se guarda hasta el commit."""
        self.session.add(attribute)

    async def delete(self, attribute: IdeaAttribute) -> None:
        """Marca el atributo para borrarlo. Se borra de verdad en el commit."""
        await self.session.delete(attribute)
