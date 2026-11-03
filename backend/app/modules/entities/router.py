"""Expone endpoints HTTP del dominio. Area: entidades.

ARCHIVO: backend/app/modules/entities/router.py

¿Qué es?
Las puertas de entrada (endpoints) de las empresas y de la competencia del proyecto.

¿Para qué sirve?
Para ver las empresas que aparecen en la investigación, y para agregar,
cambiar o quitar competidores.

Rutas (todas empiezan con /api/v1/projects/{project_id}):
- GET /entities: lista las empresas mencionadas, con cuántos hallazgos las citan.
- GET /competitors: lista los competidores.
- POST /competitors: agrega un competidor (responde 201).
- PATCH /competitors/{id}: cambia su tipo, su amenaza, su justificación o su revisión.
- DELETE /competitors/{id}: quita un competidor propio (responde 204).

¿Quién lo usa?
El frontend (features/findings, en la pestaña de competidores). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser), y el servicio revisa
que el proyecto sea del usuario.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import CurrentUser, DbSession
from app.modules.entities.schemas import (
    CompetitorCreate,
    CompetitorRead,
    CompetitorUpdate,
    EntityRead,
)
from app.modules.entities.service import EntityService

# Todas las rutas cuelgan de /projects/{project_id} y se agrupan como "entities" en /docs.
router = APIRouter(prefix="/projects/{project_id}", tags=["entities"])


def get_entity_service(db: DbSession) -> EntityService:
    """Crea el servicio de entidades con la sesión de base de datos de esta petición."""
    return EntityService(db)


# Atajo de tipo para no repetir la dependencia en cada ruta.
Service = Annotated[EntityService, Depends(get_entity_service)]


@router.get("/entities", response_model=list[EntityRead])
async def list_entities(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[EntityRead]:
    """Lista las empresas del proyecto, con cuántos hallazgos las mencionan."""
    return await service.list_entities(user, project_id)


@router.get("/competitors", response_model=list[CompetitorRead])
async def list_competitors(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[CompetitorRead]:
    """Lista los competidores del proyecto."""
    return await service.list_competitors(user, project_id)


@router.post("/competitors", response_model=CompetitorRead, status_code=status.HTTP_201_CREATED)
async def create_competitor(
    project_id: uuid.UUID, data: CompetitorCreate, user: CurrentUser, service: Service
) -> CompetitorRead:
    """Agrega un competidor, sobre una entidad existente o una nueva por nombre. Responde 201."""
    return await service.create_competitor(user, project_id, data)


@router.patch("/competitors/{competitor_id}", response_model=CompetitorRead)
async def update_competitor(
    project_id: uuid.UUID,
    competitor_id: uuid.UUID,
    data: CompetitorUpdate,
    user: CurrentUser,
    service: Service,
) -> CompetitorRead:
    """Cambia tipo, amenaza, justificación o revisión de un competidor."""
    return await service.update_competitor(user, project_id, competitor_id, data)


@router.delete("/competitors/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competitor(
    project_id: uuid.UUID, competitor_id: uuid.UUID, user: CurrentUser, service: Service
) -> None:
    """Quita un competidor propio. Los de la IA no se borran: solo se rechazan. Responde 204."""
    await service.delete_competitor(user, project_id, competitor_id)
