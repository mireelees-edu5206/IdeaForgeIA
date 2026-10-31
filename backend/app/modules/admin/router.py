"""Expone endpoints HTTP del dominio. Area: administracion."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.deps import AdminUser, AppSettings, DbSession
from app.modules.admin.lab.router import router as lab_router
from app.modules.admin.schemas import AdminOverview, AdminUserRead, AdminUserUpdate
from app.modules.admin.service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service(db: DbSession, settings: AppSettings) -> AdminService:
    """Obtiene admin service en administracion."""
    return AdminService(db, settings)


Service = Annotated[AdminService, Depends(get_admin_service)]


@router.get("/overview", response_model=AdminOverview)
async def admin_overview(_: AdminUser, service: Service) -> AdminOverview:
    """Resumen de métricas de la administración."""
    return await service.overview()


@router.get("/users", response_model=list[AdminUserRead])
async def admin_list_users(_: AdminUser, service: Service) -> list[AdminUserRead]:
    """Lista las cuentas de usuario."""
    return await service.list_users()


@router.patch("/users/{user_id}", response_model=AdminUserRead)
async def admin_update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    admin: AdminUser,
    service: Service,
) -> AdminUserRead:
    """Gestiona update user en administracion."""
    return await service.update_user(admin, user_id, data)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: uuid.UUID, request: Request, admin: AdminUser, service: Service
) -> Response:
    """Gestiona delete user en administracion."""
    supabase_user_id = await service.delete_user(admin, user_id)
    verifier = request.app.state.supabase_jwt_verifier
    # Rama condicional: se cumple supabase_user_id is not None and verifier is not None.
    if supabase_user_id is not None and verifier is not None:
        verifier.forget_user(supabase_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


router.include_router(lab_router)
