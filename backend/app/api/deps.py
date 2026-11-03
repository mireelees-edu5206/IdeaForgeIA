"""Dependencias de la API: quién hace la petición, a qué base de datos, y si tiene permiso.

ARCHIVO: backend/app/api/deps.py

¿Qué es?
Un conjunto de piezas que FastAPI llama antes de ejecutar un endpoint. Cada una prepara algo
que el endpoint necesita:
- get_db: una sesión de base de datos para esta petición.
- get_app_settings: la configuración del backend.
- get_current_user: el usuario que inició sesión (lee el token Bearer y lo valida).
- require_admin: exige que ese usuario sea administrador.

¿Para qué sirve?
Para no repetir el mismo código de autenticación en cada router. Un endpoint solo declara
"necesito un usuario" y FastAPI se encarga del resto.

¿Quién lo usa?
Casi todos los routers de la API. También main.py (para la ruta /perfil).

Tipos reutilizables (Annotated):
- DbSession, AppSettings, CurrentUser y AdminUser son atajos. Un endpoint los usa así:
  async def mi_ruta(user: CurrentUser, db: DbSession): ...

Flujo de autenticación:
1. Si la petición no trae token Bearer, responde 401.
2. Si la autenticación heredada está activa y el token es suyo, lo acepta.
3. Si no, valida el token con Supabase (verifier) y busca o crea el perfil local.
4. Si la cuenta está desactivada o el correo no coincide con otra cuenta, responde error.
"""

import secrets
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings
from app.core.errors import (
    ConflictError,
    ForbiddenError,
    ServiceUnavailableError,
    UnauthorizedError,
)
from app.core.rate_limit import LoginRateLimiter
from app.core.security import decode_access_token, hash_password
from app.core.supabase_auth import (
    SupabaseAuthUnavailableError,
    SupabaseEmailNotConfirmedError,
    SupabaseTokenError,
    SupabaseTokenVerifier,
)
from app.modules.users.models import User, UserRole
from app.modules.users.repository import UserRepository


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """Entrega una sesión de base de datos para una sola petición.

    Los servicios hacen commit explícito. Si algo falla antes, la sesión se cierra sin guardar.
    """
    # "async with" abre la sesión y la cierra al terminar la petición, pase lo que pase.
    async with request.app.state.sessionmaker() as session:
        yield session


def get_app_settings(request: Request) -> Settings:
    """Entrega la configuración del backend guardada en la aplicación."""
    return request.app.state.settings


def get_login_limiter(request: Request) -> LoginRateLimiter:
    """Entrega el contador de intentos de login guardado en la aplicación."""
    return request.app.state.login_limiter


# Atajos para usar en las firmas de los endpoints (ver el encabezado del archivo).
DbSession = Annotated[AsyncSession, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_app_settings)]

# "auto_error=False" evita que FastAPI responda solo cuando falta el token; lo manejamos nosotros.
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Busca al usuario local que corresponde al token Bearer de Supabase.

    Responde con error si falta el token, si no es válido, si la cuenta está desactivada,
    o si el correo ya pertenece a otra cuenta.
    """
    # Sin token, no hay sesión.
    if credentials is None:
        raise UnauthorizedError()
    invalid = UnauthorizedError("El token no es válido o ha expirado.", code="invalid_token")
    # El token local solo se acepta durante una migración explícita de autenticación.
    if settings.legacy_auth_enabled and settings.secret_key is not None:
        user_id = decode_access_token(
            credentials.credentials, settings.secret_key.get_secret_value()
        )
        if user_id is not None:
            user = await UserRepository(db).get_by_id(user_id)
            if user is None or not user.is_active:
                raise invalid
            return user

    # El verificador de Supabase se creó al arrancar, si SUPABASE_URL está configurada.
    verifier: SupabaseTokenVerifier | None = request.app.state.supabase_jwt_verifier
    if verifier is None:
        # Con auth heredada, un token que no fue aceptado arriba es inválido.
        if settings.legacy_auth_enabled:
            raise invalid
        raise ServiceUnavailableError(
            "Configura SUPABASE_URL y las claves de autenticación en el backend.",
            code="supabase_auth_not_configured",
        )
    # Validar el token y consultar a Supabase pueden tardar: se hacen en otro hilo.
    try:
        claims = await run_in_threadpool(verifier.decode, credentials.credentials)
        auth_user = await run_in_threadpool(
            verifier.get_verified_user, credentials.credentials, claims
        )
    except SupabaseEmailNotConfirmedError as exc:
        raise ForbiddenError(str(exc), code="email_not_confirmed") from exc
    except SupabaseTokenError as exc:
        raise invalid from exc
    except SupabaseAuthUnavailableError as exc:
        raise ServiceUnavailableError(
            "No se pudo verificar la cuenta con Supabase. Inténtalo de nuevo.",
            code="supabase_auth_unavailable",
        ) from exc
    # Se agregan los metadatos que devuelve Supabase (nombre, proveedor), para crear el perfil.
    claims["user_metadata"] = auth_user.get("user_metadata")
    claims["app_metadata"] = auth_user.get("app_metadata")
    user = await _get_or_create_supabase_user(db, claims)
    if not user.is_active:
        raise invalid
    return user


async def _get_or_create_supabase_user(db: AsyncSession, claims: dict) -> User:
    """Vincula la cuenta de Supabase con un perfil local, o crea el perfil si no existe.

    Reglas:
    - Si ya hay un perfil con ese id de Supabase, se usa tal cual.
    - Si hay un perfil con ese correo y todavía no tiene id de Supabase, se vincula.
    - Si el correo ya pertenece a otro id de Supabase, se rechaza (conflicto).
    - Si no existe nada, se crea un perfil nuevo con contraseña aleatoria (no se usa).
    """
    repository = UserRepository(db)
    supabase_user_id = UUID(claims["sub"])
    email = claims["email"].strip().lower()
    # "with_for_update" bloquea la fila mientras la revisamos, para evitar dos cuentas iguales.
    user = await db.scalar(
        select(User).where(User.supabase_user_id == supabase_user_id).with_for_update()
    )
    if user is None:
        user = await db.scalar(select(User).where(User.email == email).with_for_update())
        if user is not None:
            # Si ese perfil ya está vinculado a otra identidad de Supabase, no se mezcla.
            if user.supabase_user_id is not None and user.supabase_user_id != supabase_user_id:
                raise ConflictError(
                    "Este correo ya está vinculado a otra cuenta.",
                    code="supabase_identity_conflict",
                )
            user.supabase_user_id = supabase_user_id
            user.last_login_at = datetime.now(UTC)
            try:
                await db.commit()
            except IntegrityError as exc:
                await db.rollback()
                raise ConflictError(
                    "No se pudo vincular esta identidad con la cuenta existente.",
                    code="supabase_identity_conflict",
                ) from exc
    else:
        existing_email = await repository.get_by_email(email)
        # Si otro perfil ya usa este correo, no se puede cambiar el correo de este.
        if existing_email is not None and existing_email.id != user.id:
            raise ConflictError(
                "Este correo ya está asociado a otra cuenta.",
                code="supabase_email_conflict",
            )
        # El correo cambió en Supabase: se actualiza el perfil local.
        if user.email.lower() != email:
            user.email = email
            try:
                await db.commit()
            except IntegrityError as exc:
                await db.rollback()
                raise ConflictError(
                    "Este correo ya está asociado a otra cuenta.",
                    code="supabase_email_conflict",
                ) from exc

    if user is None:
        # El nombre sale de los metadatos de Supabase. Si no hay, se usa la parte antes de la @.
        metadata = claims.get("user_metadata")
        metadata = metadata if isinstance(metadata, dict) else {}
        full_name = metadata.get("full_name") or metadata.get("name")
        if not isinstance(full_name, str):
            full_name = email.partition("@")[0]
        # Se quitan espacios sobrantes y se limita a 120 caracteres.
        full_name = " ".join(full_name.split())[:120] or "Usuario"
        user = User(
            email=email,
            full_name=full_name,
            # Contraseña aleatoria y larga: nadie la conoce, porque la cuenta entra por Supabase.
            password_hash=await hash_password(secrets.token_urlsafe(48)),
            supabase_user_id=supabase_user_id,
            last_login_at=datetime.now(UTC),
        )
        db.add(user)
        try:
            await db.commit()
        except IntegrityError as exc:
            # Si otra petición creó la misma cuenta al mismo tiempo, la buscamos y la usamos.
            await db.rollback()
            user = await repository.get_by_supabase_user_id(supabase_user_id)
            if user is None:
                raise ConflictError(
                    "No se pudo crear la cuenta asociada a Supabase.",
                    code="supabase_identity_conflict",
                ) from exc
    return user


# Atajo: un endpoint que declara "user: CurrentUser" recibe el usuario que inició sesión.
CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    """Exige que el usuario sea administrador. Si no, responde 403."""
    if user.role != UserRole.ADMIN:
        raise ForbiddenError()
    return user


# Atajo: un endpoint que declara "admin: AdminUser" solo funciona para administradores.
AdminUser = Annotated[User, Depends(require_admin)]
