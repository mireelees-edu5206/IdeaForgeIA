from fastapi import APIRouter

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.auth.service import AuthService
from app.modules.users.schemas import PasswordChange, UserRead, UserUpdate
from app.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["users"])
legacy_password_router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
async def update_me(data: UserUpdate, user: CurrentUser, db: DbSession) -> UserRead:
    return UserRead.model_validate(await UserService(db).update_profile(user, data))


@legacy_password_router.put("/me/password", status_code=204)
async def change_password(
    data: PasswordChange, user: CurrentUser, db: DbSession, settings: AppSettings
) -> None:
    await AuthService(db, settings).change_password(user, data)
