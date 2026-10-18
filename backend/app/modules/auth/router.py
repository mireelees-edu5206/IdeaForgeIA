from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import AppSettings, DbSession, get_login_limiter
from app.core.errors import TooManyRequestsError
from app.core.rate_limit import LoginRateLimiter
from app.modules.auth.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPair
from app.modules.auth.service import AuthService, InvalidCredentialsError
from app.modules.users.schemas import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: DbSession, settings: AppSettings) -> AuthService:
    return AuthService(db, settings)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
LimiterDep = Annotated[LoginRateLimiter, Depends(get_login_limiter)]


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, service: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(await service.register(data))


@router.post("/login", response_model=TokenPair)
async def login(
    data: LoginRequest, request: Request, service: AuthServiceDep, limiter: LimiterDep
) -> TokenPair:
    ip = request.client.host if request.client else "unknown"
    retry_after = limiter.retry_after(ip, data.email)
    if retry_after is not None:
        raise TooManyRequestsError(
            "Demasiados intentos fallidos. Inténtalo más tarde.",
            headers={"Retry-After": str(retry_after)},
        )
    try:
        tokens = await service.login(data)
    except InvalidCredentialsError:
        limiter.register_failure(ip, data.email)
        raise
    limiter.reset(ip, data.email)
    return tokens


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshRequest, service: AuthServiceDep) -> TokenPair:
    return await service.refresh(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshRequest, service: AuthServiceDep) -> None:
    await service.logout(data.refresh_token)
