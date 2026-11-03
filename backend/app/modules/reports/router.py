"""Expone endpoints HTTP del dominio. Area: informes/veredicto.

ARCHIVO: backend/app/modules/reports/router.py

¿Qué es?
Las puertas de entrada (endpoints) del informe final. El informe es el "veredicto" que resume la
idea: qué tan viable parece, qué falta validar y cuáles son los siguientes pasos.

¿Para qué sirve?
Para pedir un informe nuevo, ver la lista de informes de un proyecto y abrir uno en detalle.

Rutas (todas empiezan con /api/v1/projects/{project_id}/reports):
- POST: pide un informe nuevo (responde 202: en proceso).
  Puede recibir zonas geográficas opcionales.
- GET: lista los informes del proyecto, del más reciente al más antiguo.
- GET /{report_id}: el detalle de un informe, con todas sus secciones.

¿Quién lo usa?
El frontend (features/reports). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser), y el servicio revisa que el proyecto sea
del usuario.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Request, status

from app.api.deps import CurrentUser, DbSession
from app.modules.reports.runner import ReportRunner
from app.modules.reports.schemas import ReportCreate, ReportDetail, ReportListItem, ReportRead
from app.modules.reports.service import ReportService

# Todas las rutas cuelgan de /projects/{project_id}/reports y se agrupan como "reports" en /docs.
router = APIRouter(prefix="/projects/{project_id}/reports", tags=["reports"])


def get_report_service(db: DbSession) -> ReportService:
    """Crea el servicio de informes con la sesión de base de datos de esta petición."""
    return ReportService(db)


def get_report_runner(request: Request) -> ReportRunner:
    """Entrega el ejecutor de informes que se creó al arrancar el servidor (ver main.py)."""
    return request.app.state.report_runner


# Atajos de tipo para escribir menos en las firmas de cada ruta.
Service = Annotated[ReportService, Depends(get_report_service)]
Runner = Annotated[ReportRunner, Depends(get_report_runner)]
# El cuerpo de la petición es opcional: puede no mandarse nada.
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
    """Pide un informe nuevo. Responde 202: se está generando en segundo plano.

    Si la persona indicó zonas geográficas, se pasan al servicio.
    Si no, el informe se genera sin zonas.
    """
    report = await service.start(
        user,
        project_id,
        runner.provider,
        data.geographic_scopes if data is not None else None,
    )
    # El informe se genera después de responder, sin hacer esperar a la persona.
    background.add_task(runner.run, report.id)
    return report


@router.get("", response_model=list[ReportListItem])
async def list_reports(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[ReportListItem]:
    """Lista los informes del proyecto, del más reciente al más antiguo."""
    return await service.list_for_project(user, project_id)


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
) -> ReportDetail:
    """Devuelve un informe completo, con todas sus secciones."""
    return await service.get(user, project_id, report_id)
