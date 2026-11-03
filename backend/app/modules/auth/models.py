"""Define entidades ORM y restricciones de persistencia. Area: acceso local heredado.

ARCHIVO: backend/app/modules/auth/models.py

¿Qué es?
La tabla de tokens de renovación (refresh_tokens). Un token de renovación es el "permiso para seguir
dentro" sin volver a escribir la contraseña. Cada fila guarda la huella de ese
token, nunca el token.

¿Para qué sirve?
Para renovar la sesión, revocarla al cerrar sesión, y detectar si alguien
intenta reutilizar un token viejo.

¿Quién lo usa?
repository.py y service.py de este mismo módulo. Este módulo es la autenticación
heredada: solo se usa
mientras la migración a Supabase no esté completa.

Importante: el token en claro nunca se guarda. Solo su huella SHA-256 (token_hash).
"""

import uuid
from datetime import datetime

from sqlalchemy import CHAR, CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class RefreshToken(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Un token de renovación: quién lo tiene, cuándo vence y si ya fue usado o revocado."""

    __tablename__ = "refresh_tokens"
    # El vencimiento debe ser posterior a la creación.
    __table_args__ = (CheckConstraint("expires_at > created_at", name="expiry_after_creation"),)

    # A qué usuario pertenece. Si se borra el usuario, se borran sus tokens.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # SHA-256 en hexadecimal: nunca se guarda el token en claro.
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    # Cuándo deja de servir.
    expires_at: Mapped[datetime]
    # Cuándo se revocó (cerrar sesión o rotación). Vacío mientras sigue vigente.
    revoked_at: Mapped[datetime | None]
    # El token que lo reemplazó al renovarse. Vacío si no se ha renovado.
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("refresh_tokens.id", ondelete="SET NULL")
    )
