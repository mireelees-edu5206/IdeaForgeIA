"""Expone endpoints HTTP del dominio. Area: investigacion web.

ARCHIVO: backend/app/modules/research/router.py

¿Qué es?
Las puertas de entrada (endpoints) de la investigación. Cada función de este archivo responde a
una dirección de la API y a un método HTTP (GET o POST).

¿Para qué sirve?
Para que el frontend pueda iniciar una investigación, ver su avance, ver el detalle y revisar
las fuentes que se encontraron.

Rutas de este archivo (todas empiezan con /api/v1/projects/{project_id}):
- POST /research-runs: inicia una investigación (responde 202: "recibido, en proceso").
- GET /research-runs: lista las investigaciones del proyecto.
- GET /research-runs/{run_id}: detalle de una investigación, con sus consultas y evidencias.
- GET /sources: lista de fuentes del proyecto.

¿Quién lo usa?
El frontend (features/research/api.ts). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser) y el servicio revisa que el proyecto
sea de esa persona. Si no lo es, responde "no encontrado" y no revela que existe.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.research.orchestrator import ResearchOrchestrator
from app.modules.research.schemas import ResearchRunDetail, ResearchRunRead, SourceRead
from app.modules.research.service import ResearchService

# Todas las rutas cuelgan de /projects/{project_id}.
# En /docs aparecen agrupadas con la etiqueta "research".
router = APIRouter(prefix="/projects/{project_id}", tags=["research"])


def get_research_service(db: DbSession) -> ResearchService:
    """Crea el servicio de investigación con la sesión de base de datos de esta petición."""
    return ResearchService(db)


def get_orchestrator(request: Request) -> ResearchOrchestrator:
    """Entrega el orquestador que se creó al arrancar el servidor (ver main.py)."""
    return request.app.state.research_orchestrator


# Atajos de tipo para escribir menos en las firmas de cada ruta.
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
    """Inicia una investigación. Responde 202: se creó y ahora corre en segundo plano.

    El servicio crea la investigación en estado "pending". Después, la tarea de fondo ejecuta
    el orquestador sin hacer esperar a la persona que pidió la búsqueda.
    """
    run = await service.start_run(user, project_id, orchestrator.provider, settings)
    # BackgroundTasks ejecuta orchestrator.run después de responder, con el id de la investigación.
    background.add_task(orchestrator.run, run.id)
    return run


@router.get("/research-runs", response_model=list[ResearchRunRead])
async def list_research_runs(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[ResearchRunRead]:
    """Lista las investigaciones del proyecto, de la más reciente a la más antigua."""
    return await service.list_runs(user, project_id)


@router.get("/research-runs/{run_id}", response_model=ResearchRunDetail)
async def get_research_run(
    project_id: uuid.UUID, run_id: uuid.UUID, user: CurrentUser, service: Service
) -> ResearchRunDetail:
    """Devuelve una investigación con sus consultas, fuentes y evidencias.

    El frontend la consulta cada 2 segundos mientras la investigación sigue corriendo.
    """
    return await service.get_run(user, project_id, run_id)


@router.get("/sources", response_model=list[SourceRead])
async def list_sources(
    project_id: uuid.UUID, user: CurrentUser, service: Service
) -> list[SourceRead]:
    """Lista las fuentes únicas del proyecto.

    Cada fuente trae cuántas veces se citó y cuántas evidencias tiene.
    """
    return await service.list_sources(user, project_id)
