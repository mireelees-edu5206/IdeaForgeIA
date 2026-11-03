"""Expone endpoints HTTP del dominio. Area: resultados/evidencia.

ARCHIVO: backend/app/modules/findings/router.py

¿Qué es?
Las puertas de entrada (endpoints) de los resultados de la investigación. Cada función responde a
una dirección y a un método HTTP.

¿Para qué sirve?
Para que el frontend pueda listar los resultados, agregar uno propio, cambiar su revisión o su
texto, y eliminarlo.

Rutas (todas empiezan con /api/v1/projects/{project_id}/findings):
- GET: lista los resultados. Acepta filtros opcionales por investigación, categoría y estado.
- POST: agrega un resultado escrito por la persona (responde 201: creado).
- PATCH /{finding_id}: cambia campos del resultado (solo los que se mandan).
- DELETE /{finding_id}: elimina un resultado propio (responde 204: sin contenido).

¿Quién lo usa?
El frontend (features/findings/api.ts). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser), y el servicio revisa que el proyecto sea
de esa persona.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DbSession
from app.core.enums import ResearchCategory, ReviewStatus
from app.modules.findings.schemas import FindingCreate, FindingRead, FindingUpdate
from app.modules.findings.service import FindingService

# Todas las rutas cuelgan de /projects/{project_id}/findings y se agrupan como "findings" en /docs.
router = APIRouter(prefix="/projects/{project_id}/findings", tags=["findings"])


def get_finding_service(db: DbSession) -> FindingService:
    """Crea el servicio de resultados con la sesión de base de datos de esta petición."""
    return FindingService(db)


# Atajo de tipo para no repetir la dependencia en cada ruta.
Service = Annotated[FindingService, Depends(get_finding_service)]


@router.get("", response_model=list[FindingRead])
async def list_findings(
    project_id: uuid.UUID,
    user: CurrentUser,
    service: Service,
    # Filtros opcionales: si no se mandan, se devuelven todos.
    run_id: uuid.UUID | None = None,
    finding_type: ResearchCategory | None = None,
    # Query() indica que este filtro viene de la URL (?review_status=accepted).
    review_status: Annotated[ReviewStatus | None, Query()] = None,
) -> list[FindingRead]:
    """Lista los resultados del proyecto, con los filtros que se pidan."""
    return await service.list_findings(user, project_id, run_id, finding_type, review_status)


@router.post("", response_model=FindingRead, status_code=status.HTTP_201_CREATED)
async def create_finding(
    project_id: uuid.UUID, data: FindingCreate, user: CurrentUser, service: Service
) -> FindingRead:
    """Agrega un resultado que escribe la persona. Responde 201: se creó."""
    return await service.create_finding(user, project_id, data)


@router.patch("/{finding_id}", response_model=FindingRead)
async def update_finding(
    project_id: uuid.UUID,
    finding_id: uuid.UUID,
    data: FindingUpdate,
    user: CurrentUser,
    service: Service,
) -> FindingRead:
    """Cambia los campos que se mandan del resultado (revisión, texto, confianza, etc.)."""
    return await service.update_finding(user, project_id, finding_id, data)


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    project_id: uuid.UUID, finding_id: uuid.UUID, user: CurrentUser, service: Service
) -> None:
    """Elimina un resultado propio. Responde 204: se borró y no hay nada que devolver."""
    await service.delete_finding(user, project_id, finding_id)
