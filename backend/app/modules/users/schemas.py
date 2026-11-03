"""Valida contratos de entrada/salida. Area: perfiles.

ARCHIVO: backend/app/modules/users/schemas.py

¿Qué es?
Las "fichas" del perfil para entrar y salir de la API:
- UserRead: los datos del perfil que ve el frontend (sin la contraseña).
- UserUpdate: el nombre completo que la persona quiere cambiar.
- PasswordChange: la contraseña actual y la nueva.

¿Para qué sirve?
Para validar los datos. Por ejemplo, una contraseña nueva debe tener entre 8 y 128 caracteres,
y el nombre no puede estar vacío.

¿Quién lo usa?
router.py, service.py, models.py (la lista de roles) y los módulos de autenticación.
"""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.modules.users.models import UserRole

# Política de contraseñas (NIST SP 800-63B): longitud, sin reglas de composición.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

# Contraseña nueva: entre 8 y 128 caracteres.
Password = Annotated[
    str, StringConstraints(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
]
# Contraseña ya existente (login, verificación): sin mínimo, para no filtrar la política.
ExistingPassword = Annotated[str, StringConstraints(min_length=1, max_length=PASSWORD_MAX_LENGTH)]
# Nombre completo: sin espacios sobrantes, entre 1 y 120 letras.
FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class UserRead(BaseModel):
    """El perfil de una persona tal como lo recibe el frontend. No incluye la contraseña."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # Identificador interno.
    email: str  # Correo de inicio de sesión.
    full_name: str  # Nombre que se muestra.
    role: UserRole  # Rol: persona normal o administradora.
    created_at: datetime  # Cuándo se creó la cuenta.


class UserUpdate(BaseModel):
    """Lo que manda la persona para cambiar su nombre. Es obligatorio."""

    # "extra=forbid" rechaza campos que no existen en esta ficha.
    model_config = ConfigDict(extra="forbid")

    full_name: FullName


class PasswordChange(BaseModel):
    """Lo que manda la persona para cambiar su contraseña: la actual y la nueva."""

    model_config = ConfigDict(extra="forbid")

    current_password: ExistingPassword  # La contraseña que tiene hoy.
    new_password: Password  # La contraseña nueva (entre 8 y 128 caracteres).
