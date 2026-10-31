"""Valida contratos de entrada/salida. Area: perfiles."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.modules.users.models import UserRole

# Política de contraseñas (NIST SP 800-63B): longitud, sin reglas de composición.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

Password = Annotated[
    str, StringConstraints(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
]
# Contraseña ya existente (login, verificación): sin mínimo, para no filtrar la política.
ExistingPassword = Annotated[str, StringConstraints(min_length=1, max_length=PASSWORD_MAX_LENGTH)]
FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class UserRead(BaseModel):
    """Contrato de datos para usuario read."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    created_at: datetime


class UserUpdate(BaseModel):
    """Representa usuario actualizacion."""

    model_config = ConfigDict(extra="forbid")

    full_name: FullName


class PasswordChange(BaseModel):
    """Representa contrasena change."""

    model_config = ConfigDict(extra="forbid")

    current_password: ExistingPassword
    new_password: Password
