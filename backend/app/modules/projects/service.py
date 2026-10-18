import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AttributeType, Origin
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.schemas import Page, PageParams
from app.modules.projects.models import IdeaAttribute, Project, ProjectStatus
from app.modules.projects.repository import IdeaAttributeRepository, ProjectRepository
from app.modules.projects.schemas import (
    IdeaAttributeCreate,
    IdeaAttributeRead,
    IdeaAttributeUpdate,
    ProjectCreate,
    ProjectDetail,
    ProjectRead,
    ProjectsOverview,
    ProjectSummary,
    ProjectUpdate,
    StructureCheck,
)
from app.modules.research.repository import ResearchRunRepository
from app.modules.users.models import User

MAX_VALUES_PER_ATTRIBUTE = 10

# Mínimo para considerar la idea estructurada (cada uno con al menos un valor confirmado).
REQUIRED_ATTRIBUTES = (
    AttributeType.PROBLEM,
    AttributeType.SOLUTION,
    AttributeType.CUSTOMER_SEGMENT,
)
_EDITABLE_STATUSES = (ProjectStatus.DRAFT, ProjectStatus.STRUCTURED)


def check_structure(attributes: list[IdeaAttribute]) -> StructureCheck:
    confirmed = {a.attribute_type for a in attributes if a.is_confirmed}
    missing = [t for t in REQUIRED_ATTRIBUTES if t not in confirmed]
    pending = sum(1 for a in attributes if a.origin == Origin.AI and not a.is_confirmed)
    return StructureCheck(
        ready=not missing and pending == 0, missing=missing, pending_suggestions=pending
    )


class ProjectNotFoundError(NotFoundError):
    code = "project_not_found"
    message = "El proyecto no existe."


class AttributeNotFoundError(NotFoundError):
    code = "attribute_not_found"
    message = "El atributo no existe."


async def get_owned_project(session: AsyncSession, user: User, project_id: uuid.UUID) -> Project:
    """Para los módulos que cuelgan de un proyecto: 404 si no existe o es de otro usuario."""
    project = await ProjectRepository(session).get_owned(project_id, user.id)
    if project is None:
        raise ProjectNotFoundError()
    return project


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.projects = ProjectRepository(session)
        self.attributes = IdeaAttributeRepository(session)
        self.research_runs = ResearchRunRepository(session)

    async def _get_owned(self, user: User, project_id: uuid.UUID) -> Project:
        # 404 tanto si no existe como si es de otro usuario: no se revela su existencia.
        project = await self.projects.get_owned(project_id, user.id)
        if project is None:
            raise ProjectNotFoundError()
        return project

    async def _ensure_no_active_research(self, project: Project) -> None:
        if await self.research_runs.has_active(project.id):
            raise ConflictError(
                "Hay una investigación en curso. Espera a que termine para modificar el proyecto.",
                code="research_in_progress",
            )

    async def _mark_modified(self, project: Project) -> None:
        """La idea cambió: registra actividad y vuelve a borrador (hay que reconfirmarla).

        Las investigaciones anteriores se conservan como historial. Se llama antes del commit:
        si hay una investigación en curso, el error descarta los cambios pendientes.
        """
        await self._ensure_no_active_research(project)
        if project.status != ProjectStatus.DRAFT:
            project.status = ProjectStatus.DRAFT
        await self.projects.touch(project.id)

    # ─────────────── Proyectos ───────────────

    async def overview(self, user: User) -> ProjectsOverview:
        by_status = await self.projects.count_by_status(user.id)
        return ProjectsOverview(total=sum(by_status.values()), by_status=by_status)

    async def list_projects(
        self, user: User, params: PageParams, status: ProjectStatus | None
    ) -> Page[ProjectSummary]:
        items, total = await self.projects.list_owned(user.id, status, params.limit, params.offset)
        return Page(
            items=[ProjectSummary.model_validate(p) for p in items],
            total=total,
            limit=params.limit,
            offset=params.offset,
        )

    async def create_project(self, user: User, data: ProjectCreate) -> ProjectRead:
        project = Project(user_id=user.id, title=data.title, raw_idea=data.raw_idea)
        self.projects.add(project)
        await self.session.commit()
        return ProjectRead.model_validate(project)

    async def get_project(self, user: User, project_id: uuid.UUID) -> ProjectDetail:
        project = await self._get_owned(user, project_id)
        attributes = await self.attributes.list_for_project(project.id)
        return ProjectDetail.model_validate(
            {
                **ProjectRead.model_validate(project).model_dump(),
                "attributes": [IdeaAttributeRead.model_validate(a) for a in attributes],
                "structure": check_structure(attributes),
            }
        )

    async def update_project(
        self, user: User, project_id: uuid.UUID, data: ProjectUpdate
    ) -> ProjectRead:
        project = await self._get_owned(user, project_id)
        if data.raw_idea is not None and data.raw_idea != project.raw_idea:
            await self._mark_modified(project)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        await self.session.commit()
        return ProjectRead.model_validate(project)

    async def confirm_structure(self, user: User, project_id: uuid.UUID) -> ProjectDetail:
        project = await self._get_owned(user, project_id)
        if project.status not in _EDITABLE_STATUSES:
            raise ConflictError(
                "El proyecto ya está en investigación y su estructura no puede cambiarse.",
                code="invalid_status",
            )
        structure = check_structure(await self.attributes.list_for_project(project.id))
        if not structure.ready:
            details = [
                {"field": t.value, "message": "Falta al menos un valor confirmado."}
                for t in structure.missing
            ]
            if structure.pending_suggestions:
                details.append(
                    {
                        "field": "pending_suggestions",
                        "message": "Revisa las sugerencias de la IA: confírmalas o elimínalas.",
                    }
                )
            raise AppError(
                "La estructura todavía no está completa.",
                code="structure_incomplete",
                details=details,
            )
        project.status = ProjectStatus.STRUCTURED
        await self.session.commit()
        return await self.get_project(user, project_id)

    async def delete_project(self, user: User, project_id: uuid.UUID) -> None:
        project = await self._get_owned(user, project_id)
        await self._ensure_no_active_research(project)
        await self.projects.delete(project)
        await self.session.commit()

    # ─────────────── Atributos de la idea ───────────────

    async def list_attributes(self, user: User, project_id: uuid.UUID) -> list[IdeaAttributeRead]:
        project = await self._get_owned(user, project_id)
        attributes = await self.attributes.list_for_project(project.id)
        return [IdeaAttributeRead.model_validate(a) for a in attributes]

    async def add_attribute(
        self, user: User, project_id: uuid.UUID, data: IdeaAttributeCreate
    ) -> IdeaAttributeRead:
        project = await self._get_owned(user, project_id)
        count, position = await self.attributes.count_and_next_position(
            project.id, data.attribute_type
        )
        if count >= MAX_VALUES_PER_ATTRIBUTE:
            raise AppError(
                f"Se permiten como máximo {MAX_VALUES_PER_ATTRIBUTE} valores por atributo.",
                code="attribute_limit_reached",
            )
        # Lo que escribe el usuario es un dato suyo: se considera confirmado.
        attribute = IdeaAttribute(
            project_id=project.id,
            attribute_type=data.attribute_type,
            value=data.value,
            position=position,
            origin=Origin.USER,
            is_confirmed=True,
        )
        self.attributes.add(attribute)
        await self._mark_modified(project)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # dos altas simultáneas obtuvieron la misma posición
            await self.session.rollback()
            raise ConflictError("El atributo cambió mientras se guardaba. Reinténtalo.") from exc
        return IdeaAttributeRead.model_validate(attribute)

    async def update_attribute(
        self, user: User, project_id: uuid.UUID, attribute_id: uuid.UUID, data: IdeaAttributeUpdate
    ) -> IdeaAttributeRead:
        project = await self._get_owned(user, project_id)
        attribute = await self.attributes.get(project.id, attribute_id)
        if attribute is None:
            raise AttributeNotFoundError()
        if data.value is not None and data.value != attribute.value:
            # Si el usuario reescribe una sugerencia de la IA, pasa a ser dato del usuario.
            attribute.value = data.value
            attribute.origin = Origin.USER
            attribute.is_confirmed = True
        if data.is_confirmed is not None:
            attribute.is_confirmed = data.is_confirmed
        await self._mark_modified(project)
        await self.session.commit()
        return IdeaAttributeRead.model_validate(attribute)

    async def delete_attribute(
        self, user: User, project_id: uuid.UUID, attribute_id: uuid.UUID
    ) -> None:
        project = await self._get_owned(user, project_id)
        attribute = await self.attributes.get(project.id, attribute_id)
        if attribute is None:
            raise AttributeNotFoundError()
        await self.attributes.delete(attribute)
        await self._mark_modified(project)
        await self.session.commit()
