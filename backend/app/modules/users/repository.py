"""Agrupa consultas SQL del dominio. Area: perfiles."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User


class UserRepository:
    """Repositorio de consultas para usuario."""

    def __init__(self, session: AsyncSession) -> None:
        """Gestiona la inicializacion para usuarios."""
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Obtiene por id."""
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        """Obtiene por correo."""
        return await self.session.scalar(select(User).where(User.email == email))

    async def get_by_supabase_user_id(self, user_id: uuid.UUID) -> User | None:
        """Obtiene por supabase usuario id."""
        return await self.session.scalar(select(User).where(User.supabase_user_id == user_id))

    def add(self, user: User) -> None:
        """Agrega el flujo principal."""
        self.session.add(user)
