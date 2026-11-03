"""Expone endpoints HTTP del dominio. Area: proyectos.

ARCHIVO: backend/app/modules/projects/router.py

¿Qué es?
Las puertas de entrada (endpoints) de los proyectos y de las partes de la idea.
Cada función responde
a una dirección y a un método HTTP.

¿Para qué sirve?
Para que el frontend pueda crear, listar, abrir, cambiar, confirmar y borrar proyectos, y agregar,
cambiar o borrar las partes de su idea.

Rutas principales (todas empiezan con /api/v1/projects):
- GET: lista los proyectos, con filtro por etapa y paginación.
- GET /summary: cuántos proyectos hay en cada etapa.
- POST: crea un proyecto (responde 201).
- GET /{id}, PATCH /{id}, DELETE /{id}: ver, cambiar o borrar un proyecto.
- POST /{id}/confirm-structure: confirma la estructura para poder investigar.
- GET, POST, PATCH y DELETE de /{id}/attributes: las partes de la idea.

¿Quién lo usa?
El frontend (features/projects). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser), y el servicio revisa
que el proyecto sea del usuario.
"""

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

# Todas las rutas cuelgan de /projects y se agrupan como "projects" en /docs.
router = APIRouter(prefix="/projects", tags=["projects"])


def get_project_service(db: DbSession) -> ProjectService:
    """Crea el servicio de proyectos con la sesión de base de datos de esta petición."""
    return ProjectService(db)


# Atajos de tipo para no repetir las dependencias en cada ruta.
Service = Annotated[ProjectService, Depends(get_project_service)]
Pagination = Annotated[PageParams, Depends(page_params)]


# ─────────────── Proyectos ───────────────


@router.get("", response_model=Page[ProjectSummary])
async def list_projects(
    user: CurrentUser,
    service: Service,
    pagination: Pagination,
    # El parámetro se llama "status" en la URL (?status=draft), pero en el código se usa
    # status_filter.
    status_filter: Annotated[ProjectStatus | None, Query(alias="status")] = None,
) -> Page[ProjectSummary]:
    """Lista los proyectos del usuario, con paginación y filtro opcional por etapa."""
    return await service.list_projects(user, pagination, status_filter)


# Declarada antes de /{project_id} para que "summary" no se interprete como un id.
@router.get("/summary", response_model=ProjectsOverview)
async def projects_overview(user: CurrentUser, service: Service) -> ProjectsOverview:
    """Resumen de los proyectos de la persona conectada: total y cuántos hay en cada etapa."""
    return await service.overview(user)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, user: CurrentUser, service: Service) -> ProjectRead:
    """Crea un proyecto con su idea inicial. Responde 201: se creó."""
    return await service.create_project(user, data)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: uuid.UUID, user: CurrentUser, service: Service) -> ProjectDetail:
    """Devuelve el detalle del proyecto, con sus atributos y el estado de su estructura."""
    return await service.get_project(user, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID, data: ProjectUpdate, user: CurrentUser, service: Service
) -> ProjectRead:
    """Cambia el título o la idea del proyecto. Cambiar la idea la regresa a borrador."""
    return await service.update_project(user, project_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: uuid.UUID, user: CurrentUser, service: Service) -> None:
    """Borra el proyecto y todo lo que cuelga de él. Responde 204: se borró."""
    await service.delete_project(user, project_id)


@router.post("/{project_id}/confirm-structure", response_model=ProjectDetail)
async def confirm_structure(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> ProjectDetail:
    """Confirma que la idea está lista para investigarse. Pasa el proyecto a "estructurado"."""
    return await service.confirm_structure(user, project_id)


# ─────────────── Atributos de la idea ───────────────


@router.get("/{project_id}/attributes", response_model=list[IdeaAttributeRead])
async def list_attributes(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[IdeaAttributeRead]:
    """Lista las partes de la idea del proyecto, en el orden del formulario."""
    return await service.list_attributes(user, project_id)


@router.post(
    "/{project_id}/attributes",
    response_model=IdeaAttributeRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_attribute(
    project_id: uuid.UUID, data: IdeaAttributeCreate, user: CurrentUser, service: Service
) -> IdeaAttributeRead:
    """Agrega un valor a una parte de la idea. Responde 201: se creó."""
    return await service.add_attribute(user, project_id, data)


@router.patch("/{project_id}/attributes/{attribute_id}", response_model=IdeaAttributeRead)
async def update_attribute(
    project_id: uuid.UUID,
    attribute_id: uuid.UUID,
    data: IdeaAttributeUpdate,
    user: CurrentUser,
    service: Service,
) -> IdeaAttributeRead:
    """Cambia el valor o la confirmación de una parte de la idea."""
    return await service.update_attribute(user, project_id, attribute_id, data)


@router.delete("/{project_id}/attributes/{attribute_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attribute(
    project_id: uuid.UUID, attribute_id: uuid.UUID, user: CurrentUser, service: Service
) -> None:
    """Borra un valor de la idea. Responde 204: se borró."""
    await service.delete_attribute(user, project_id, attribute_id)
