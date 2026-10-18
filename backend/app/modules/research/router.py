import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.research.orchestrator import ResearchOrchestrator
from app.modules.research.schemas import ResearchRunDetail, ResearchRunRead, SourceRead
from app.modules.research.service import ResearchService

router = APIRouter(prefix="/projects/{project_id}", tags=["research"])


def get_research_service(db: DbSession) -> ResearchService:
    return ResearchService(db)


def get_orchestrator(request: Request) -> ResearchOrchestrator:
    return request.app.state.research_orchestrator


Service = Annotated[ResearchService, Depends(get_research_service)]
Orchestrator = Annotated[ResearchOrchestrator, Depends(get_orchestrator)]


@router.post("/research-runs", response_model=ResearchRunRead, status_code=status.HTTP_202_ACCEPTED)
async def start_research(
    project_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
    orchestrator: Orchestrator,
    settings: AppSettings,
    background: BackgroundTasks,
) -> ResearchRunRead:
    run = await service.start_run(user, project_id, orchestrator.provider, settings)
    background.add_task(orchestrator.run, run.id)
    return run


@router.get("/research-runs", response_model=list[ResearchRunRead])
async def list_research_runs(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[ResearchRunRead]:
    return await service.list_runs(user, project_id)


@router.get("/research-runs/{run_id}", response_model=ResearchRunDetail)
async def get_research_run(
    project_id: uuid.UUID, run_id: uuid.UUID, user: CurrentUser, service: Service
) -> ResearchRunDetail:
    return await service.get_run(user, project_id, run_id)


@router.get("/sources", response_model=list[SourceRead])
async def list_sources(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[SourceRead]:
    return await service.list_sources(user, project_id)
