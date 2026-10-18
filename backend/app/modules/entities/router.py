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

router = APIRouter(prefix="/projects/{project_id}", tags=["entities"])


def get_entity_service(db: DbSession) -> EntityService:
    return EntityService(db)


Service = Annotated[EntityService, Depends(get_entity_service)]


@router.get("/entities", response_model=list[EntityRead])
async def list_entities(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[EntityRead]:
    return await service.list_entities(user, project_id)


@router.get("/competitors", response_model=list[CompetitorRead])
async def list_competitors(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[CompetitorRead]:
    return await service.list_competitors(user, project_id)


@router.post("/competitors", response_model=CompetitorRead, status_code=status.HTTP_201_CREATED)
async def create_competitor(
    project_id: uuid.UUID, data: CompetitorCreate, user: CurrentUser, service: Service
) -> CompetitorRead:
    return await service.create_competitor(user, project_id, data)


@router.patch("/competitors/{competitor_id}", response_model=CompetitorRead)
async def update_competitor(
    project_id: uuid.UUID,
    competitor_id: uuid.UUID,
    data: CompetitorUpdate,
    user: CurrentUser,
    service: Service,
) -> CompetitorRead:
    return await service.update_competitor(user, project_id, competitor_id, data)


@router.delete("/competitors/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competitor(
    project_id: uuid.UUID, competitor_id: uuid.UUID, user: CurrentUser, service: Service
) -> None:
    await service.delete_competitor(user, project_id, competitor_id)
