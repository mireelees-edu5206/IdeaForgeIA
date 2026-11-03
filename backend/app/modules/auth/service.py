"""Aplica reglas de negocio y permisos. Area: acceso local heredado.

ARCHIVO: backend/app/modules/auth/service.py

¿Qué es?
Las reglas de la autenticación heredada: crear cuentas, verificar contraseñas, emitir tokens,
renovarlos y revocarlos.

¿Para qué sirve?
Para que solo entren personas con contraseña correcta y cuenta activa, y para que una sesión robada
se pueda cortar.

¿Quién lo usa?
router.py de este módulo y users/router.py (cambio de contraseña).

Reglas de seguridad importantes:
- Si el correo no existe, se hace igualmente una verificación de contraseña.
  Así la respuesta tarda lo
  mismo y nadie puede saber qué correos están registrados.
- Cada token de renovación se usa una sola vez: al renovarlo, el anterior se revoca.
- Si alguien intenta usar un token ya revocado, se asume que fue robado
  y se cierran todas las sesiones
  de esa persona.
- Cambiar la contraseña revoca todas las sesiones abiertas.
"""

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

# Registro de mensajes del backend (aparecen en la consola del servidor).
logger = logging.getLogger(__name__)


class InvalidCredentialsError(UnauthorizedError):
    """Correo o contraseña incorrectos. Responde 401 con un mensaje genérico, a propósito."""

    code = "invalid_credentials"
    message = "Correo o contraseña incorrectos."


class InvalidRefreshTokenError(UnauthorizedError):
    """El token de renovación no sirve (no existe, venció, está revocado o la cuenta está
    inactiva)."""

    code = "invalid_refresh_token"
    message = "La sesión no es válida o ha expirado. Inicia sesión de nuevo."


class AuthService:
    """Reglas de la autenticación heredada para cada petición."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        """Crea los repositorios de usuarios y tokens con la misma sesión."""
        self.session = session
        self.settings = settings
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)

    async def register(self, data: RegisterRequest) -> User:
        """Crea una cuenta nueva. Si el correo ya existe, responde conflicto."""
        if await self.users.get_by_email(data.email) is not None:
            raise ConflictError("Ya existe una cuenta con ese correo.", code="email_taken")
        user = User(
            email=data.email,
            password_hash=await hash_password(data.password),
            full_name=data.full_name,
        )
        self.users.add(user)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # registro simultáneo con el mismo email
            # Si otra petición registró el mismo correo al mismo tiempo, se rechaza esta.
            await self.session.rollback()
            raise ConflictError("Ya existe una cuenta con ese correo.", code="email_taken") from exc
        return user

    async def login(self, data: LoginRequest) -> TokenPair:
        """Verifica correo, contraseña y cuenta activa, y devuelve los tokens nuevos."""
        user = await self.users.get_by_email(data.email)
        if user is None:
            # Se verifica una contraseña falsa para que la respuesta tarde lo mismo.
            await verify_against_dummy(data.password)
            raise InvalidCredentialsError()
        if not await verify_password(data.password, user.password_hash):
            raise InvalidCredentialsError()
        if not user.is_active:
            raise ForbiddenError("La cuenta está desactivada.", code="account_disabled")

        # Si el hash guardado usa parámetros viejos, se recalcula con los actuales.
        if password_needs_rehash(user.password_hash):
            user.password_hash = await hash_password(data.password)
        now = datetime.now(UTC)
        user.last_login_at = now
        pair, _ = self._issue_tokens(user.id, now)
        await self.session.commit()
        return pair

    async def refresh(self, raw_token: str) -> TokenPair:
        """Cambia un token de renovación válido por uno nuevo. El anterior queda revocado."""
        now = datetime.now(UTC)
        # Se busca por huella y se bloquea la fila para que dos renovaciones simultáneas no se
        # mezclen.
        token = await self.tokens.get_by_hash_for_update(hash_refresh_token(raw_token))
        if token is None:
            raise InvalidRefreshTokenError()
        if token.revoked_at is not None:
            # Reuso de un token ya rotado: posible robo. Se cierran todas las sesiones.
            logger.warning("Reuso de refresh token detectado para el usuario %s", token.user_id)
            await self.tokens.revoke_all_active(token.user_id, now)
            await self.session.commit()
            raise InvalidRefreshTokenError()
        if token.expires_at <= now:
            raise InvalidRefreshTokenError()
        user = await self.users.get_by_id(token.user_id)
        if user is None or not user.is_active:
            raise InvalidRefreshTokenError()

        # Se revoca el token usado y se emite uno nuevo que queda vinculado a él.
        token.revoked_at = now
        pair, new_token = self._issue_tokens(user.id, now)
        await self.session.flush()
        token.replaced_by_id = new_token.id
        await self.session.commit()
        return pair

    async def logout(self, raw_token: str) -> None:
        """Revoca el token de renovación. No dice si el token existía, para no dar pistas."""
        token = await self.tokens.get_by_hash_for_update(hash_refresh_token(raw_token))
        if token is not None and token.revoked_at is None:
            token.revoked_at = datetime.now(UTC)
            await self.session.commit()

    async def change_password(self, user: User, data: PasswordChange) -> None:
        """Cambia la contraseña y cierra todas las sesiones abiertas de la persona."""
        if not await verify_password(data.current_password, user.password_hash):
            raise AppError("La contraseña actual no es correcta.", code="invalid_current_password")
        user.password_hash = await hash_password(data.new_password)
        await self.tokens.revoke_all_active(user.id, datetime.now(UTC))
        await self.session.commit()

    def _issue_tokens(self, user_id: uuid.UUID, now: datetime) -> tuple[TokenPair, RefreshToken]:
        """Crea el token de acceso y el de renovación. Guarda solo la huella del de renovación."""
        # Sin clave secreta, la autenticación heredada no puede emitir tokens.
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
        # El token en claro solo se devuelve a la persona; en la base queda la huella.
        pair = TokenPair(
            access_token=access_token, refresh_token=raw_refresh, expires_in=expires_in
        )
        return pair, refresh
