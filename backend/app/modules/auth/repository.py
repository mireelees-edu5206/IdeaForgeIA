"""Agrupa consultas SQL del dominio. Area: acceso local heredado.

ARCHIVO: backend/app/modules/auth/repository.py

¿Qué es?
La capa que busca y actualiza los tokens de renovación en la base de datos.

¿Para qué sirve?
Para que service.py pueda buscar un token por su huella, bloquearlo mientras lo renueva, y revocar
todos los de una persona de una vez.

¿Quién lo usa?
auth/service.py.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import RefreshToken


class RefreshTokenRepository:
    """Consultas sobre los tokens de renovación."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    def add(self, token: RefreshToken) -> None:
        """Agrega un token a la sesión. Todavía no se guarda hasta el commit."""
        self.session.add(token)

    async def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None:
        """Busca un token por su huella y lo bloquea para que dos renovaciones no se pisen."""
        # FOR UPDATE: dos refresh simultáneos con el mismo token se serializan.
        return await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        )

    async def revoke_all_active(self, user_id: uuid.UUID, now: datetime) -> None:
        """Revoca todos los tokens vigentes de una persona (cerrar todas sus sesiones)."""
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
