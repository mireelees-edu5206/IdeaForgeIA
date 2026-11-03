"""Expone endpoints HTTP del dominio. Area: acceso local heredado.

ARCHIVO: backend/app/modules/auth/router.py

¿Qué es?
Las puertas de entrada de la autenticación heredada: registrarse, entrar, renovar la sesión y salir.

¿Para qué sirve?
Para que una persona pueda iniciar sesión con correo y contraseña sin Supabase,
mientras la migración
no esté completa. Este módulo solo se monta si LEGACY_AUTH_ENABLED está activado (ver main.py).

Rutas (empiezan con /api/v1/auth):
- POST /register: crea una cuenta (responde 201).
- POST /login: revisa correo y contraseña, y devuelve un token de acceso y uno de renovación.
- POST /refresh: cambia el token de renovación por uno nuevo.
- POST /logout: revoca el token de renovación (responde 204).

Protección contra fuerza bruta: /login cuenta los intentos fallidos. Si hay demasiados, responde 429
con el encabezado Retry-After (cuántos segundos esperar).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import AppSettings, DbSession, get_login_limiter
from app.core.errors import TooManyRequestsError
from app.core.rate_limit import LoginRateLimiter
from app.modules.auth.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPair
from app.modules.auth.service import AuthService, InvalidCredentialsError
from app.modules.users.schemas import UserRead

# Todas las rutas cuelgan de /auth y se agrupan como "auth" en /docs.
router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: DbSession, settings: AppSettings) -> AuthService:
    """Crea el servicio de autenticación con la sesión y la configuración de esta petición."""
    return AuthService(db, settings)


# Atajos de tipo para no repetir las dependencias en cada ruta.
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
LimiterDep = Annotated[LoginRateLimiter, Depends(get_login_limiter)]


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, service: AuthServiceDep) -> UserRead:
    """Registra una cuenta nueva con la autenticación heredada. Responde 201: se creó."""
    return UserRead.model_validate(await service.register(data))


@router.post("/login", response_model=TokenPair)
async def login(
    data: LoginRequest, request: Request, service: AuthServiceDep, limiter: LimiterDep
) -> TokenPair:
    """Inicia sesión. Si hay demasiados intentos fallidos, responde 429 con Retry-After."""
    # La IP del cliente identifica a quien intenta entrar. Si no se conoce, se usa "unknown".
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
        # Cada fallo suma al contador de intentos; después se vuelve a lanzar el error.
        limiter.register_failure(ip, data.email)
        raise
    # Si el inicio de sesión salió bien, se borra el contador de esa cuenta.
    limiter.reset(ip, data.email)
    return tokens


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshRequest, service: AuthServiceDep) -> TokenPair:
    """Cambia el token de renovación por uno nuevo y entrega un token de acceso nuevo."""
    return await service.refresh(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshRequest, service: AuthServiceDep) -> None:
    """Cierra la sesión revocando el token de renovación. Responde 204."""
    await service.logout(data.refresh_token)
