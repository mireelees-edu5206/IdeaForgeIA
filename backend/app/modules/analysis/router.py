import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from app.api.deps import CurrentUser, DbSession
from app.modules.analysis.kinds import KINDS, AnalysisKind
from app.modules.analysis.runner import AnalysisRunner
from app.modules.analysis.schemas import AnalysisRead
from app.modules.analysis.service import AnalysisService
from app.modules.research.schemas import ResearchRunRead

router = APIRouter(prefix="/projects/{project_id}", tags=["analysis"])


def get_analysis_service(db: DbSession) -> AnalysisService:
    return AnalysisService(db)


def get_runner(request: Request) -> AnalysisRunner:
    return request.app.state.analysis_runner


Service = Annotated[AnalysisService, Depends(get_analysis_service)]
Runner = Annotated[AnalysisRunner, Depends(get_runner)]


@router.post(
    "/research-runs/{run_id}/analysis",
    response_model=ResearchRunRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_analysis(
    project_id: uuid.UUID,
    run_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
    runner: Runner,
    background: BackgroundTasks,
) -> ResearchRunRead:
    run = await service.start(user, project_id, run_id)
    background.add_task(runner.run, run.id)
    return run


@router.get("/analysis", response_model=AnalysisRead)
async def get_analysis(
    project_id: uuid.UUID, user: CurrentUser, service: Service, run_id: uuid.UUID | None = None
) -> AnalysisRead:
    return await service.overview(user, project_id, run_id)


def _register(kind: AnalysisKind) -> None:
    """Alta, edición y borrado con los esquemas propios de cada tipo."""
    create_schema, update_schema, read_schema = kind.create, kind.update, kind.read
    path = f"/{kind.key}"
    name = kind.key.replace("-", "_")

    async def create(
        project_id: uuid.UUID, data: create_schema, user: CurrentUser, service: Service
    ):
        return await service.create(kind, user, project_id, data)

    async def update(
        project_id: uuid.UUID,
        item_id: uuid.UUID,
        data: update_schema,
        user: CurrentUser,
        service: Service,
    ):
        return await service.update(kind, user, project_id, item_id, data)

    async def remove(
        project_id: uuid.UUID, item_id: uuid.UUID, user: CurrentUser, service: Service
    ):
        await service.delete(kind, user, project_id, item_id)

    router.add_api_route(
        path,
        create,
        methods=["POST"],
        response_model=read_schema,
        status_code=status.HTTP_201_CREATED,
        name=f"create_{name}",
    )
    router.add_api_route(
        f"{path}/{{item_id}}",
        update,
        methods=["PATCH"],
        response_model=read_schema,
        name=f"update_{name}",
    )
    router.add_api_route(
        f"{path}/{{item_id}}",
        remove,
        methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT,
        name=f"delete_{name}",
    )


for _kind in KINDS:
    _register(_kind)
