import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import AdminUser, DbSession
from app.modules.admin.schemas import AdminOverview, AdminUserRead, AdminUserUpdate
from app.modules.admin.service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service(db: DbSession) -> AdminService:
    return AdminService(db)


Service = Annotated[AdminService, Depends(get_admin_service)]


@router.get("/overview", response_model=AdminOverview)
async def admin_overview(_: AdminUser, service: Service) -> AdminOverview:
    return await service.overview()


@router.get("/users", response_model=list[AdminUserRead])
async def admin_list_users(_: AdminUser, service: Service) -> list[AdminUserRead]:
    return await service.list_users()


@router.patch("/users/{user_id}", response_model=AdminUserRead)
async def admin_update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    admin: AdminUser,
    service: Service,
) -> AdminUserRead:
    return await service.update_user(admin, user_id, data)
