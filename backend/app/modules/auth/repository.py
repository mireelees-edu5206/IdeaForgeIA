"""Agrupa consultas SQL del dominio. Area: acceso local heredado."""

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import RefreshToken


class RefreshTokenRepository:
    """Repositorio de consultas para renovacion token."""

    def __init__(self, session: AsyncSession) -> None:
        """Gestiona la inicializacion para autenticacion."""
        self.session = session

    def add(self, token: RefreshToken) -> None:
        """Agrega el flujo principal."""
        self.session.add(token)

    async def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None:
        """Obtiene y bloquea un refresh token para serializar su rotacion."""
        # FOR UPDATE: dos refresh simultáneos con el mismo token se serializan.
        return await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        )

    async def revoke_all_active(self, user_id: uuid.UUID, now: datetime) -> None:
        """Revoca all activo."""
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
