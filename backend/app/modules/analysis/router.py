"""Expone endpoints HTTP del dominio. Area: analisis.

ARCHIVO: backend/app/modules/analysis/router.py

¿Qué es?
Las puertas de entrada (endpoints) del análisis: oportunidades, riesgos, hipótesis e información
faltante. Las rutas de los cuatro tipos se crean automáticamente a partir de la tabla de kinds.py.

¿Para qué sirve?
- Iniciar el análisis de una investigación terminada (la IA lo arma en segundo plano).
- Ver el análisis completo del proyecto.
- Agregar, cambiar y borrar cada oportunidad, riesgo, hipótesis o dato faltante.

Rutas (todas empiezan con /api/v1/projects/{project_id}):
- POST /research-runs/{run_id}/analysis: inicia el análisis (responde 202: en proceso).
- GET /analysis: devuelve el análisis completo, opcionalmente de una investigación concreta.
- POST, PATCH y DELETE de /opportunities, /risks, /hypotheses y /missing-information.

¿Quién lo usa?
El frontend (features/analysis). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser) y el servicio revisa que el proyecto sea
del usuario.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from app.api.deps import CurrentUser, DbSession
from app.modules.analysis.kinds import KINDS, AnalysisKind
from app.modules.analysis.runner import AnalysisRunner
from app.modules.analysis.schemas import AnalysisRead
from app.modules.analysis.service import AnalysisService
from app.modules.research.schemas import ResearchRunRead

# Todas las rutas cuelgan de /projects/{project_id} y se agrupan como "analysis" en /docs.
router = APIRouter(prefix="/projects/{project_id}", tags=["analysis"])


def get_analysis_service(db: DbSession) -> AnalysisService:
    """Crea el servicio de análisis con la sesión de base de datos de esta petición."""
    return AnalysisService(db)


def get_runner(request: Request) -> AnalysisRunner:
    """Entrega el ejecutor del análisis que se creó al arrancar el servidor (ver main.py)."""
    return request.app.state.analysis_runner


# Atajos de tipo para escribir menos en las firmas de cada ruta.
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
    """Inicia el análisis de una investigación terminada. Responde 202: se está procesando.

    El servicio revisa que la investigación esté lista. Después, la tarea de fondo arma el análisis
    sin hacer esperar a la persona.
    """
    run = await service.start(user, project_id, run_id)
    background.add_task(runner.run, run.id)
    return run


@router.get("/analysis", response_model=AnalysisRead)
async def get_analysis(
    project_id: uuid.UUID, user: CurrentUser, service: Service, run_id: uuid.UUID | None = None
) -> AnalysisRead:
    """Devuelve el análisis completo del proyecto. Si se indica run_id, solo el de esa
    investigación."""
    return await service.overview(user, project_id, run_id)


def _register(kind: AnalysisKind) -> None:
    """Crea las rutas de alta, edición y borrado para un tipo de análisis.

    Cada tipo usa sus propios esquemas de entrada y salida, tomados de la tabla de kinds.py.
    """
    create_schema, update_schema, read_schema = kind.create, kind.update, kind.read
    # La ruta del tipo, por ejemplo "/risks". Y un nombre interno sin guiones.
    path = f"/{kind.key}"
    name = kind.key.replace("-", "_")

    async def create(
        project_id: uuid.UUID, data: create_schema, user: CurrentUser, service: Service
    ):
        """Crea un elemento de este tipo en el proyecto."""
        return await service.create(kind, user, project_id, data)

    async def update(
        project_id: uuid.UUID,
        item_id: uuid.UUID,
        data: update_schema,
        user: CurrentUser,
        service: Service,
    ):
        """Cambia los campos que se mandan de un elemento de este tipo."""
        return await service.update(kind, user, project_id, item_id, data)

    async def remove(
        project_id: uuid.UUID, item_id: uuid.UUID, user: CurrentUser, service: Service
    ):
        """Borra un elemento de este tipo. Responde 204: se borró y no hay nada que devolver."""
        await service.delete(kind, user, project_id, item_id)

    # Alta: POST, responde 201 (creado).
    router.add_api_route(
        path,
        create,
        methods=["POST"],
        response_model=read_schema,
        status_code=status.HTTP_201_CREATED,
        name=f"create_{name}",
    )
    # Edición: PATCH en /{tipo}/{id}. Solo cambia lo que se manda.
    router.add_api_route(
        f"{path}/{{item_id}}",
        update,
        methods=["PATCH"],
        response_model=read_schema,
        name=f"update_{name}",
    )
    # Borrado: DELETE en /{tipo}/{id}.
    router.add_api_route(
        f"{path}/{{item_id}}",
        remove,
        methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT,
        name=f"delete_{name}",
    )


# Crea las rutas de los cuatro tipos al cargar el archivo. Las tres rutas de cada tipo salen de
# _register.
for _kind in KINDS:
    _register(_kind)
