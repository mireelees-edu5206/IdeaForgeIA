import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DbSession
from app.core.enums import ResearchCategory, ReviewStatus
from app.modules.findings.schemas import FindingCreate, FindingRead, FindingUpdate
from app.modules.findings.service import FindingService

router = APIRouter(prefix="/projects/{project_id}/findings", tags=["findings"])


def get_finding_service(db: DbSession) -> FindingService:
    return FindingService(db)


Service = Annotated[FindingService, Depends(get_finding_service)]


@router.get("", response_model=list[FindingRead])
async def list_findings(
    project_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
    run_id: uuid.UUID | None = None,
    finding_type: ResearchCategory | None = None,
    review_status: Annotated[ReviewStatus | None, Query()] = None,
) -> list[FindingRead]:
    return await service.list_findings(user, project_id, run_id, finding_type, review_status)


@router.post("", response_model=FindingRead, status_code=status.HTTP_201_CREATED)
async def create_finding(
    project_id: uuid.UUID, data: FindingCreate, user: CurrentUser, service: Service
) -> FindingRead:
    return await service.create_finding(user, project_id, data)


@router.patch("/{finding_id}", response_model=FindingRead)
async def update_finding(
    project_id: uuid.UUID,
    finding_id: uuid.UUID,
    data: FindingUpdate,
    user: CurrentUser,
    service: Service,
) -> FindingRead:
    return await service.update_finding(user, project_id, finding_id, data)


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    project_id: uuid.UUID, finding_id: uuid.UUID, user: CurrentUser, service: Service
) -> None:
    await service.delete_finding(user, project_id, finding_id)
