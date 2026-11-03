"""Expone endpoints HTTP del dominio. Area: perfiles.

ARCHIVO: backend/app/modules/users/router.py

¿Qué es?
Las puertas de entrada (endpoints) del perfil de la persona conectada.

¿Para qué sirve?
Para que el frontend pueda leer el perfil, cambiar el nombre y cambiar la contraseña.

Rutas (empiezan con /api/v1/users):
- GET /me: devuelve el perfil de la persona conectada.
- PATCH /me: cambia el nombre completo.
- PUT /me/password: cambia la contraseña (solo si la autenticación heredada está activa).

¿Quién lo usa?
El frontend (features/auth y configuración). main.py lo conecta a la aplicación.

Importante: todas las rutas exigen sesión (CurrentUser).
Cada persona solo puede tocar su propio perfil.
"""

from fastapi import APIRouter

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.auth.service import AuthService
from app.modules.users.schemas import PasswordChange, UserRead, UserUpdate
from app.modules.users.service import UserService

# Rutas del perfil, que están siempre activas.
router = APIRouter(prefix="/users", tags=["users"])
# Cambio de contraseña. Solo se registra si la autenticación heredada está encendida.
legacy_password_router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_me(user: CurrentUser) -> UserRead:
    """Devuelve el perfil de la persona conectada."""
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
async def update_me(data: UserUpdate, user: CurrentUser, db: DbSession) -> UserRead:
    """Cambia el nombre completo del perfil propio."""
    return UserRead.model_validate(await UserService(db).update_profile(user, data))


@legacy_password_router.put("/me/password", status_code=204)
async def change_password(
    data: PasswordChange, user: CurrentUser, db: DbSession, settings: AppSettings
) -> None:
    """Cambia la contraseña. Responde 204: se cambió y no hay nada que devolver."""
    await AuthService(db, settings).change_password(user, data)
