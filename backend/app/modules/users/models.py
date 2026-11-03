"""Define entidades ORM y restricciones de persistencia. Area: perfiles.

ARCHIVO: backend/app/modules/users/models.py

¿Qué es?
La tabla de usuarios en la base de datos. Cada fila es una persona que usa IdeaForge.

¿Para qué sirve?
Para saber quién es cada persona, si está activa, si es administradora, y qué cuenta de Supabase
le corresponde. La contraseña nunca se guarda en texto: solo su huella (hash).

¿Quién lo usa?
deps.py (identifica al usuario en cada petición), repository.py, service.py y todos los módulos que
guardan algo "del usuario" (proyectos, uso de IA, administración).

Reglas importantes que la base de datos hace cumplir:
- El correo es único y no distingue mayúsculas (CITEXT).
- El correo no puede pasar de 254 caracteres (límite del estándar).
- El nombre completo no puede estar vacío y tiene máximo 120 letras.
- El id de Supabase, si existe, también es único.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, String, true
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class UserRole(StrEnum):
    """Qué puede hacer la cuenta dentro de la aplicación."""

    USER = "user"  # Persona normal: solo ve sus propios proyectos.
    ADMIN = "admin"  # Administradora: ve el panel de administración.


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Una persona que usa IdeaForge."""

    __tablename__ = "users"
    __table_args__ = (
        # El correo puede tener máximo 254 caracteres, el límite del estándar.
        CheckConstraint("char_length(email) <= 254", name="email_length"),
        # El nombre no puede estar formado solo por espacios.
        CheckConstraint("btrim(full_name) <> ''", name="full_name_not_blank"),
    )

    # Correo de inicio de sesión. Es único y no distingue mayúsculas (CITEXT).
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    # Id de la cuenta en Supabase. Vacío si la cuenta es anterior a Supabase.
    supabase_user_id: Mapped[uuid.UUID | None] = mapped_column(unique=True)
    # Huella de la contraseña (nunca el texto). Argon2 la genera.
    password_hash: Mapped[str]
    # Nombre que se muestra en la aplicación, de hasta 120 letras.
    full_name: Mapped[str] = mapped_column(String(120))
    # Rol de la cuenta. Por defecto, persona normal.
    role: Mapped[UserRole] = mapped_column(
        str_enum(UserRole, "role", 10), server_default=UserRole.USER.value
    )
    # Si la cuenta está activa. Una cuenta desactivada no puede entrar.
    is_active: Mapped[bool] = mapped_column(server_default=true())
    # Última vez que inició sesión. Vacía si nunca lo ha hecho.
    last_login_at: Mapped[datetime | None]
