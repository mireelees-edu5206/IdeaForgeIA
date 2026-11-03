"""Valida contratos de entrada/salida. Area: acceso local heredado.

ARCHIVO: backend/app/modules/auth/schemas.py

¿Qué es?
Las "fichas" de la autenticación heredada:
- RegisterRequest: correo, contraseña y nombre para crear una cuenta.
- LoginRequest: correo y contraseña para entrar.
- RefreshRequest: el token de renovación para cambiar de sesión o cerrarla.
- TokenPair: lo que devuelve el servidor al entrar: un token de acceso y uno de renovación.

¿Para qué sirve?
Para validar los datos antes de tocar la base de datos. El correo se guarda siempre en minúsculas.

¿Quién lo usa?
router.py y service.py de este mismo módulo.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints, field_validator

from app.modules.users.schemas import ExistingPassword, FullName, Password

# Token de renovación: entre 1 y 256 caracteres.
RefreshTokenValue = Annotated[str, StringConstraints(min_length=1, max_length=256)]


class _EmailRequest(BaseModel):
    """Base de las peticiones que llevan correo: valida el formato y lo pasa a minúsculas."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Pasa el correo a minúsculas, para que "Ana@Mail.com" y "ana@mail.com" sean la misma
        cuenta."""
        return value.lower()


class RegisterRequest(_EmailRequest):
    """Lo que manda la persona para crear una cuenta."""

    password: Password  # Contraseña nueva: entre 8 y 128 caracteres.
    full_name: FullName  # Nombre que se mostrará.


class LoginRequest(_EmailRequest):
    """Lo que manda la persona para entrar."""

    password: ExistingPassword  # La contraseña que ya tiene.


class RefreshRequest(BaseModel):
    """El token de renovación que se usa para renovar la sesión o cerrarla."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: RefreshTokenValue


class TokenPair(BaseModel):
    """Lo que devuelve el servidor al entrar o renovar: los dos tokens y cuánto dura el de
    acceso."""

    access_token: str  # Token de acceso: se manda en cada petición.
    refresh_token: str  # Token de renovación: sirve para pedir un acceso nuevo.
    # Siempre "bearer" (se manda en el encabezado Authorization).
    token_type: Literal["bearer"] = "bearer"
    expires_in: int  # segundos de vida del access token
