"""Expone endpoints HTTP del dominio. Area: laboratorio administrativo.

Un router agrupa las rutas (URLs) de un tema. Este router vive bajo el prefijo /api/v1/admin/lab.
Cada función es un endpoint: recibe una petición HTTP, le pide el trabajo al servicio y devuelve la
respuesta. El router no calcula nada; eso lo hacen el servicio y los algoritmos.

Todas las rutas exigen un usuario administrador (AdminUser). Un usuario normal recibe 403 Forbidden.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import AdminUser, DbSession
from app.modules.admin.lab.schemas import (
    AdminLabProjectsResponse,
    HypothesisBudgetRequest,
    HypothesisBudgetResponse,
    LabLearningResponse,
    LabMetricsResponse,
    LabPlaceSearchRequest,
    LabPlaceSearchResponse,
    LabPropositionsResponse,
    LabRouteRequest,
    LabRouteResponse,
    LabTracePathRequest,
    LabTracePathResponse,
    ProjectTraceGraph,
)
from app.modules.admin.lab.service import AdminLabService
from app.modules.geo.providers.base import GeoProvider

# El prefijo "/lab" se suma al prefijo /api/v1/admin que pone main.py. "tags" agrupa las rutas
# en la documentación automática (Swagger, en /docs).
router = APIRouter(prefix="/lab", tags=["admin-lab"])


def get_admin_lab_service(request: Request, db: DbSession) -> AdminLabService:
    """Crea el servicio del laboratorio para cada petición.

    FastAPI llama a esta función automáticamente (inyección de dependencias). Le da:
    - la sesión de base de datos (db), que FastAPI abre y cierra por petición;
    - el proveedor de mapas (geo_provider), que se guardó en app.state al arrancar el servidor.
    """
    provider: GeoProvider = request.app.state.geo_provider
    return AdminLabService(db, provider)


# "Annotated" une un tipo con instrucciones extra. Así FastAPI sabe que "Service" se obtiene con
# get_admin_lab_service y no lo tiene que pedir el cliente.
Service = Annotated[AdminLabService, Depends(get_admin_lab_service)]
# Días de métricas: un número entero entre 7 y 90. Si no se manda, FastAPI usa 30 (ver metrics).
Days = Annotated[int, Query(ge=7, le=90)]


@router.get("/metrics", response_model=LabMetricsResponse)
async def lab_metrics(_: AdminUser, service: Service, days: Days = 30) -> LabMetricsResponse:
    """Métricas de uso de la IA por día: llamadas, errores, latencia y tokens.

    GET /api/v1/admin/lab/metrics?days=30. El guion bajo "_" en AdminUser indica que el usuario
    solo se usa para comprobar permisos; su valor no se necesita en la función.
    """
    return await service.metrics(days)


@router.get("/propositions", response_model=LabPropositionsResponse)
async def lab_propositions(_: AdminUser) -> LabPropositionsResponse:
    """Reglas y tablas de verdad del sistema, más el marco PEAS del agente.

    No consulta la base de datos: los textos son fijos. Por eso no pide servicio ni sesión.
    """
    return AdminLabService.propositions()


@router.get("/learning", response_model=LabLearningResponse)
async def lab_learning(_: AdminUser, service: Service) -> LabLearningResponse:
    """Estado del aprendizaje: ejemplos revisados y el árbol si ya hay datos suficientes.

    Solo lectura. No modifica nada ni cambia las respuestas que ve la persona.
    """
    return await service.learning_report()


@router.get("/projects", response_model=AdminLabProjectsResponse)
async def lab_projects(_: AdminUser, service: Service) -> AdminLabProjectsResponse:
    """Lista los proyectos disponibles para el laboratorio (id, título, estado, dueño, zona)."""
    return await service.list_projects()


@router.get("/projects/{project_id}/trace", response_model=ProjectTraceGraph)
async def project_trace(project_id: UUID, _: AdminUser, service: Service) -> ProjectTraceGraph:
    """Grafo de trazabilidad de un proyecto: nodos (elementos) y conexiones entre ellos.

    {project_id} es parte de la URL. FastAPI lo convierte a UUID y responde 422 si no es válido.
    """
    return await service.project_trace(project_id)


@router.post("/projects/{project_id}/trace/path", response_model=LabTracePathResponse)
async def project_trace_path(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: LabTracePathRequest,
) -> LabTracePathResponse:
    """Busca el camino con menos pasos (BFS) desde la raíz del proyecto hasta un nodo.

    POST porque envía datos (el nodo destino) y calcula un resultado. Si el nodo no existe en el
    grafo, responde 200 con found=false, no 404.
    """
    return await service.trace_path(project_id, data.target_node_id)


@router.post("/projects/{project_id}/places", response_model=LabPlaceSearchResponse)
async def project_places(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: LabPlaceSearchRequest,
) -> LabPlaceSearchResponse:
    """Busca lugares reales de OpenStreetMap cerca de una zona, por palabra clave.

    Hace una consulta externa a OpenStreetMap, con sus límites de uso. No guarda nada en la base.
    """
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
    """Calcula la ruta de visita entre los lugares elegidos. No guarda nada (persisted = false)."""
    return await service.route(project_id, data)


@router.post("/projects/{project_id}/budget-plan", response_model=HypothesisBudgetResponse)
async def project_budget_plan(
    project_id: UUID,
    _: AdminUser,
    service: Service,
    data: HypothesisBudgetRequest,
) -> HypothesisBudgetResponse:
    """Elige qué hipótesis validar con un presupuesto. No guarda nada (persisted = false)."""
    return await service.budget_plan(project_id, data)
