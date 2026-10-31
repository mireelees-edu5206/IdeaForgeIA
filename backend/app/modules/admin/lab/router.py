"""Expone endpoints HTTP del dominio. Area: laboratorio administrativo."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import AdminUser, DbSession
from app.modules.admin.lab.schemas import (
    AdminLabProjectsResponse,
    HypothesisBudgetRequest,
    HypothesisBudgetResponse,
    LabMetricsResponse,
    LabPlaceSearchRequest,
    LabPlaceSearchResponse,
    LabPropositionsResponse,
    LabRouteRequest,
    LabRouteResponse,
    LabTracePathRequest,
    LabTracePathResponse,
    ProjectTraceGraph,
    ValidationScheduleRequest,
    ValidationScheduleResponse,
)
from app.modules.admin.lab.service import AdminLabService
from app.modules.geo.providers.base import GeoProvider

router = APIRouter(prefix="/lab", tags=["admin-lab"])


def get_admin_lab_service(request: Request, db: DbSession) -> AdminLabService:
    """Obtiene admin lab service en laboratorio admin."""
    provider: GeoProvider = request.app.state.geo_provider
    return AdminLabService(db, provider)


Service = Annotated[AdminLabService, Depends(get_admin_lab_service)]
Days = Annotated[int, Query(ge=7, le=90)]


@router.get("/metrics", response_model=LabMetricsResponse)
async def lab_metrics(_: AdminUser, service: Service, days: Days = 30) -> LabMetricsResponse:
    """Métricas de uso de la IA para el laboratorio (solo administradores)."""
    return await service.metrics(days)


@router.get("/propositions", response_model=LabPropositionsResponse)
async def lab_propositions(_: AdminUser) -> LabPropositionsResponse:
    """Reglas y tablas de verdad del sistema (solo administradores)."""
    return AdminLabService.propositions()


@router.get("/projects", response_model=AdminLabProjectsResponse)
async def lab_projects(_: AdminUser, service: Service) -> AdminLabProjectsResponse:
    """Lista los proyectos disponibles para el laboratorio (solo administradores)."""
    return await service.list_projects()


@router.get("/projects/{project_id}/trace", response_model=ProjectTraceGraph)
async def project_trace(project_id: UUID, _: AdminUser, service: Service) -> ProjectTraceGraph:
    """Grafo de trazabilidad de un proyecto (solo administradores)."""
    return await service.project_trace(project_id)


@router.post("/projects/{project_id}/trace/path", response_model=LabTracePathResponse)
async def project_trace_path(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: LabTracePathRequest,
) -> LabTracePathResponse:
    """Gestiona trace path en laboratorio admin."""
    return await service.trace_path(project_id, data.algorithm, data.target_node_id)


@router.post("/projects/{project_id}/places", response_model=LabPlaceSearchResponse)
async def project_places(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: LabPlaceSearchRequest,
) -> LabPlaceSearchResponse:
    """Gestiona places en laboratorio admin."""
    return await service.places(
        project_id, data.latitude, data.longitude, data.radius_m, data.keyword
    )


@router.post("/projects/{project_id}/route", response_model=LabRouteResponse)
async def project_route(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: LabRouteRequest,
) -> LabRouteResponse:
    """Gestiona route en laboratorio admin."""
    return await service.route(project_id, data)


@router.post("/projects/{project_id}/budget-plan", response_model=HypothesisBudgetResponse)
async def project_budget_plan(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: HypothesisBudgetRequest,
) -> HypothesisBudgetResponse:
    """Gestiona budget plan en laboratorio admin."""
    return await service.budget_plan(project_id, data)


@router.post("/projects/{project_id}/schedule", response_model=ValidationScheduleResponse)
async def project_schedule(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: ValidationScheduleRequest,
) -> ValidationScheduleResponse:
    """Gestiona schedule en laboratorio admin."""
    return await service.schedule(project_id, data)
