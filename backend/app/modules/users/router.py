from fastapi import APIRouter, status

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.auth.service import AuthService
from app.modules.users.schemas import PasswordChange, UserRead, UserUpdate
from app.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
async def update_me(data: UserUpdate, user: CurrentUser, db: DbSession) -> UserRead:
    return UserRead.model_validate(await UserService(db).update_profile(user, data))


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: PasswordChange, user: CurrentUser, db: DbSession, settings: AppSettings
) -> None:
    # Cierra todas las sesiones (revoca los refresh tokens).
    await AuthService(db, settings).change_password(user, data)
