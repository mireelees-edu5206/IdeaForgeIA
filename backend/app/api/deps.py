from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.rate_limit import LoginRateLimiter
from app.core.security import decode_access_token
from app.modules.users.models import User, UserRole
from app.modules.users.repository import UserRepository


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """Una sesión por petición. Los servicios hacen commit explícito; si hay error, rollback."""
    async with request.app.state.sessionmaker() as session:
        yield session


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_login_limiter(request: Request) -> LoginRateLimiter:
    return request.app.state.login_limiter


DbSession = Annotated[AsyncSession, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_app_settings)]

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    invalid = UnauthorizedError("El token no es válido o ha expirado.", code="invalid_token")
    user_id = decode_access_token(credentials.credentials, settings.secret_key.get_secret_value())
    if user_id is None:
        raise invalid
    user = await UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise invalid
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise ForbiddenError()
    return user


AdminUser = Annotated[User, Depends(require_admin)]
