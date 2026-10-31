"""Aplica reglas de negocio y permisos. Area: acceso local heredado."""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import (
    AppError,
    ConflictError,
    ForbiddenError,
    ServiceUnavailableError,
    UnauthorizedError,
)
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    password_needs_rehash,
    verify_against_dummy,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenPair
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import PasswordChange

logger = logging.getLogger(__name__)


class InvalidCredentialsError(UnauthorizedError):
    """Error que representa invalido credentials."""

    code = "invalid_credentials"
    message = "Correo o contraseña incorrectos."


class InvalidRefreshTokenError(UnauthorizedError):
    """Error que representa invalido renovacion token."""

    code = "invalid_refresh_token"
    message = "La sesión no es válida o ha expirado. Inicia sesión de nuevo."


class AuthService:
    """Servicio de reglas de negocio para autenticacion."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        """Gestiona la inicializacion para autenticacion."""
        self.session = session
        self.settings = settings
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)

    async def register(self, data: RegisterRequest) -> User:
        """Registra el flujo principal."""
        # Rama condicional: se cumple await self.users.get_by_email(data.email) is not None.
        if await self.users.get_by_email(data.email) is not None:
            raise ConflictError("Ya existe una cuenta con ese correo.", code="email_taken")
        user = User(
            email=data.email,
            password_hash=await hash_password(data.password),
            full_name=data.full_name,
        )
        self.users.add(user)
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            await self.session.commit()
        # Maneja el error IntegrityError sin detener el flujo esperado.
        except IntegrityError as exc:  # registro simultáneo con el mismo email
            await self.session.rollback()
            raise ConflictError("Ya existe una cuenta con ese correo.", code="email_taken") from exc
        return user

    async def login(self, data: LoginRequest) -> TokenPair:
        """Gestiona acceso."""
        user = await self.users.get_by_email(data.email)
        # Rama condicional: se cumple user is None.
        if user is None:
            await verify_against_dummy(data.password)
            raise InvalidCredentialsError()
        # Rama condicional: se cumple not await verify_password(data.password,
        # user.password_hash).
        if not await verify_password(data.password, user.password_hash):
            raise InvalidCredentialsError()
        # Rama condicional: se cumple not user.is_active.
        if not user.is_active:
            raise ForbiddenError("La cuenta está desactivada.", code="account_disabled")

        # Rama condicional: se cumple password_needs_rehash(user.password_hash).
        if password_needs_rehash(user.password_hash):
            user.password_hash = await hash_password(data.password)
        now = datetime.now(UTC)
        user.last_login_at = now
        pair, _ = self._issue_tokens(user.id, now)
        await self.session.commit()
        return pair

    async def refresh(self, raw_token: str) -> TokenPair:
        """Gestiona renovacion."""
        now = datetime.now(UTC)
        token = await self.tokens.get_by_hash_for_update(hash_refresh_token(raw_token))
        # Rama condicional: se cumple token is None.
        if token is None:
            raise InvalidRefreshTokenError()
        # Rama condicional: se cumple token.revoked_at is not None.
        if token.revoked_at is not None:
            # Reuso de un token ya rotado: posible robo. Se cierran todas las sesiones.
            logger.warning("Reuso de refresh token detectado para el usuario %s", token.user_id)
            await self.tokens.revoke_all_active(token.user_id, now)
            await self.session.commit()
            raise InvalidRefreshTokenError()
        # Rama condicional: se cumple token.expires_at <= now.
        if token.expires_at <= now:
            raise InvalidRefreshTokenError()
        user = await self.users.get_by_id(token.user_id)
        # Rama condicional: se cumple user is None or not user.is_active.
        if user is None or not user.is_active:
            raise InvalidRefreshTokenError()

        token.revoked_at = now
        pair, new_token = self._issue_tokens(user.id, now)
        await self.session.flush()
        token.replaced_by_id = new_token.id
        await self.session.commit()
        return pair

    async def logout(self, raw_token: str) -> None:
        """Idempotente: no revela si el token existía."""
        token = await self.tokens.get_by_hash_for_update(hash_refresh_token(raw_token))
        # Rama condicional: se cumple token is not None and token.revoked_at is None.
        if token is not None and token.revoked_at is None:
            token.revoked_at = datetime.now(UTC)
            await self.session.commit()

    async def change_password(self, user: User, data: PasswordChange) -> None:
        """Gestiona change contrasena."""
        # Rama condicional: evalua not await verify_password(data.current_password,
        # user.password_hash).
        if not await verify_password(data.current_password, user.password_hash):
            raise AppError("La contraseña actual no es correcta.", code="invalid_current_password")
        user.password_hash = await hash_password(data.new_password)
        await self.tokens.revoke_all_active(user.id, datetime.now(UTC))
        await self.session.commit()

    def _issue_tokens(self, user_id: uuid.UUID, now: datetime) -> tuple[TokenPair, RefreshToken]:
        """Gestiona issue tokens."""
        # Rama condicional: se cumple self.settings.secret_key is None.
        if self.settings.secret_key is None:
            raise ServiceUnavailableError(
                "La autenticación local está desactivada.", code="legacy_auth_disabled"
            )
        access_token, expires_in = create_access_token(
            user_id,
            self.settings.secret_key.get_secret_value(),
            self.settings.access_token_expire_minutes,
        )
        raw_refresh = generate_refresh_token()
        refresh = RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=now + timedelta(days=self.settings.refresh_token_expire_days),
        )
        self.tokens.add(refresh)
        pair = TokenPair(
            access_token=access_token, refresh_token=raw_refresh, expires_in=expires_in
        )
        return pair, refresh
