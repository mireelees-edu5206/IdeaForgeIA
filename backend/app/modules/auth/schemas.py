"""Valida contratos de entrada/salida. Area: acceso local heredado."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints, field_validator

from app.modules.users.schemas import ExistingPassword, FullName, Password

RefreshTokenValue = Annotated[str, StringConstraints(min_length=1, max_length=256)]


class _EmailRequest(BaseModel):
    """Representa correo solicitud."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Normaliza correo."""
        return value.lower()


class RegisterRequest(_EmailRequest):
    """Representa register solicitud."""

    password: Password
    full_name: FullName


class LoginRequest(_EmailRequest):
    """Representa acceso solicitud."""

    password: ExistingPassword


class RefreshRequest(BaseModel):
    """Representa renovacion solicitud."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: RefreshTokenValue


class TokenPair(BaseModel):
    """Representa token pair."""

    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int  # segundos de vida del access token
