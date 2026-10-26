import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Request, status

from app.api.deps import CurrentUser, DbSession
from app.modules.reports.runner import ReportRunner
from app.modules.reports.schemas import ReportCreate, ReportDetail, ReportListItem, ReportRead
from app.modules.reports.service import ReportService

router = APIRouter(prefix="/projects/{project_id}/reports", tags=["reports"])


def get_report_service(db: DbSession) -> ReportService:
    return ReportService(db)


def get_report_runner(request: Request) -> ReportRunner:
    return request.app.state.report_runner


Service = Annotated[ReportService, Depends(get_report_service)]
Runner = Annotated[ReportRunner, Depends(get_report_runner)]
ReportBody = Annotated[ReportCreate | None, Body()]


@router.post("", response_model=ReportRead, status_code=status.HTTP_202_ACCEPTED)
async def create_report(
    project_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
    runner: Runner,
    background: BackgroundTasks,
    data: ReportBody = None,
) -> ReportRead:
    report = await service.start(
        user,
        project_id,
        runner.provider,
        data.geographic_scopes if data is not None else None,
    )
    background.add_task(runner.run, report.id)
    return report


@router.get("", response_model=list[ReportListItem])
async def list_reports(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[ReportListItem]:
    return await service.list_for_project(user, project_id)


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
) -> ReportDetail:
    return await service.get(user, project_id, report_id)
