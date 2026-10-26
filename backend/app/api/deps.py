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
    request: Request,
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    invalid = UnauthorizedError("El token no es válido o ha expirado.", code="invalid_token")
    if settings.legacy_auth_enabled and settings.secret_key is not None:
        user_id = decode_access_token(
            credentials.credentials, settings.secret_key.get_secret_value()
        )
        if user_id is not None:
            user = await UserRepository(db).get_by_id(user_id)
            if user is None or not user.is_active:
                raise invalid
            return user

    verifier: SupabaseTokenVerifier | None = request.app.state.supabase_jwt_verifier
    if verifier is None:
        if settings.legacy_auth_enabled:
            raise invalid
        raise ServiceUnavailableError(
            "Configura SUPABASE_URL y las claves de autenticación en el backend.",
            code="supabase_auth_not_configured",
        )
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
    claims["user_metadata"] = auth_user.get("user_metadata")
    claims["app_metadata"] = auth_user.get("app_metadata")
    user = await _get_or_create_supabase_user(db, claims)
    if not user.is_active:
        raise invalid
    return user


async def _get_or_create_supabase_user(db: AsyncSession, claims: dict) -> User:
    repository = UserRepository(db)
    supabase_user_id = UUID(claims["sub"])
    email = claims["email"].strip().lower()
    user = await db.scalar(
        select(User).where(User.supabase_user_id == supabase_user_id).with_for_update()
    )
    if user is None:
        user = await db.scalar(select(User).where(User.email == email).with_for_update())
        if user is not None:
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
        if existing_email is not None and existing_email.id != user.id:
            raise ConflictError(
                "Este correo ya está asociado a otra cuenta.",
                code="supabase_email_conflict",
            )
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
        metadata = claims.get("user_metadata")
        metadata = metadata if isinstance(metadata, dict) else {}
        full_name = metadata.get("full_name") or metadata.get("name")
        if not isinstance(full_name, str):
            full_name = email.partition("@")[0]
        full_name = " ".join(full_name.split())[:120] or "Usuario"
        user = User(
            email=email,
            full_name=full_name,
            password_hash=await hash_password(secrets.token_urlsafe(48)),
            supabase_user_id=supabase_user_id,
            last_login_at=datetime.now(UTC),
        )
        db.add(user)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            user = await repository.get_by_supabase_user_id(supabase_user_id)
            if user is None:
                raise ConflictError(
                    "No se pudo crear la cuenta asociada a Supabase.",
                    code="supabase_identity_conflict",
                ) from exc
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise ForbiddenError()
    return user


AdminUser = Annotated[User, Depends(require_admin)]
