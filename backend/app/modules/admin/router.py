"""Expone endpoints HTTP del dominio. Area: administracion.

ARCHIVO: backend/app/modules/admin/router.py

¿Qué es?
Las puertas de entrada del panel de administración. Solo la usan cuentas con rol "admin".

¿Para qué sirve?
Para ver el resumen general de la aplicación, administrar cuentas
(cambiar rol, activar o desactivar,
eliminar) y entrar al laboratorio de algoritmos.

Rutas (empiezan con /api/v1/admin):
- GET /overview: métricas generales (usuarios, proyectos, investigaciones, uso de IA).
- GET /users: lista de cuentas con cuántos proyectos e investigaciones tiene cada una.
- PATCH /users/{id}: cambia el rol o activa/desactiva una cuenta.
- DELETE /users/{id}: elimina una cuenta de forma permanente (responde 204).
- Las rutas del laboratorio se incluyen al final (ver lab/router.py).

¿Quién lo usa?
El frontend (features/admin/AdminPage.tsx). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen AdminUser. Si la persona no es administradora, responde 403.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.deps import AdminUser, AppSettings, DbSession
from app.modules.admin.lab.router import router as lab_router
from app.modules.admin.schemas import AdminOverview, AdminUserRead, AdminUserUpdate
from app.modules.admin.service import AdminService

# Todas las rutas cuelgan de /admin y se agrupan como "admin" en /docs.
router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service(db: DbSession, settings: AppSettings) -> AdminService:
    """Crea el servicio de administración con la sesión y la configuración de esta petición."""
    return AdminService(db, settings)


# Atajo de tipo para no repetir la dependencia en cada ruta.
Service = Annotated[AdminService, Depends(get_admin_service)]


@router.get("/overview", response_model=AdminOverview)
async def admin_overview(_: AdminUser, service: Service) -> AdminOverview:
    """Devuelve el resumen de métricas de la administración."""
    return await service.overview()


@router.get("/users", response_model=list[AdminUserRead])
async def admin_list_users(_: AdminUser, service: Service) -> list[AdminUserRead]:
    """Lista todas las cuentas, de la más reciente a la más antigua."""
    return await service.list_users()


@router.patch("/users/{user_id}", response_model=AdminUserRead)
async def admin_update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    admin: AdminUser,
    service: Service,
) -> AdminUserRead:
    """Cambia el rol o el estado activo de una cuenta."""
    return await service.update_user(admin, user_id, data)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: uuid.UUID, request: Request, admin: AdminUser, service: Service
) -> Response:
    """Elimina una cuenta de forma permanente. Responde 204: se eliminó."""
    supabase_user_id = await service.delete_user(admin, user_id)
    verifier = request.app.state.supabase_jwt_verifier
    # Si la cuenta tenía un id de Supabase, se olvida en el verificador de tokens:
    # así sus tokens viejos dejan de servir de inmediato.
    if supabase_user_id is not None and verifier is not None:
        verifier.forget_user(supabase_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Agrega al panel las rutas del laboratorio de algoritmos (prefijo /admin/lab).
router.include_router(lab_router)
