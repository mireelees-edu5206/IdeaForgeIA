"""Expone endpoints HTTP del dominio. Area: proyectos."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DbSession
from app.core.schemas import Page, PageParams, page_params
from app.modules.projects.models import ProjectStatus
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
)
from app.modules.projects.service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


def get_project_service(db: DbSession) -> ProjectService:
    """Obtiene proyecto servicio."""
    return ProjectService(db)


Service = Annotated[ProjectService, Depends(get_project_service)]
Pagination = Annotated[PageParams, Depends(page_params)]


# ─────────────── Proyectos ───────────────


@router.get("", response_model=Page[ProjectSummary])
async def list_projects(
    user: CurrentUser,
    service: Service,
    pagination: Pagination,
    status_filter: Annotated[ProjectStatus | None, Query(alias="status")] = None,
) -> Page[ProjectSummary]:
    """Lista proyectos."""
    return await service.list_projects(user, pagination, status_filter)


# Declarada antes de /{project_id} para que "summary" no se interprete como un id.
@router.get("/summary", response_model=ProjectsOverview)
async def projects_overview(user: CurrentUser, service: Service) -> ProjectsOverview:
    """Resumen de los proyectos de la persona conectada."""
    return await service.overview(user)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, user: CurrentUser, service: Service) -> ProjectRead:
    """Crea un proyecto con su idea inicial."""
    return await service.create_project(user, data)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: uuid.UUID, user: CurrentUser, service: Service) -> ProjectDetail:
    """Obtiene el detalle de un proyecto propio."""
    return await service.get_project(user, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID, data: ProjectUpdate, user: CurrentUser, service: Service
) -> ProjectRead:
    """Actualiza proyecto."""
    return await service.update_project(user, project_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: uuid.UUID, user: CurrentUser, service: Service) -> None:
    """Elimina un proyecto propio."""
    await service.delete_project(user, project_id)


@router.post("/{project_id}/confirm-structure", response_model=ProjectDetail)
async def confirm_structure(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> ProjectDetail:
    """Gestiona confirm estructura."""
    return await service.confirm_structure(user, project_id)


# ─────────────── Atributos de la idea ───────────────


@router.get("/{project_id}/attributes", response_model=list[IdeaAttributeRead])
async def list_attributes(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[IdeaAttributeRead]:
    """Lista atributos."""
    return await service.list_attributes(user, project_id)


@router.post(
    "/{project_id}/attributes",
    response_model=IdeaAttributeRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_attribute(
    project_id: uuid.UUID, data: IdeaAttributeCreate, user: CurrentUser, service: Service
) -> IdeaAttributeRead:
    """Agrega atributo."""
    return await service.add_attribute(user, project_id, data)


@router.patch("/{project_id}/attributes/{attribute_id}", response_model=IdeaAttributeRead)
async def update_attribute(
    project_id: uuid.UUID,
    attribute_id: uuid.UUID,
    data: IdeaAttributeUpdate,
    user: CurrentUser,
    service: Service,
) -> IdeaAttributeRead:
    """Actualiza atributo."""
    return await service.update_attribute(user, project_id, attribute_id, data)


@router.delete("/{project_id}/attributes/{attribute_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attribute(
    project_id: uuid.UUID, attribute_id: uuid.UUID, user: CurrentUser, service: Service
) -> None:
    """Elimina atributo."""
    await service.delete_attribute(user, project_id, attribute_id)
