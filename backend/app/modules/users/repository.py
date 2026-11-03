"""Agrupa consultas SQL del dominio. Area: perfiles.

ARCHIVO: backend/app/modules/users/repository.py

¿Qué es?
La capa que busca usuarios en la base de datos: por id, por correo o por id de Supabase.

¿Para qué sirve?
Para que deps.py y los servicios encuentren a una persona sin escribir SQL cada vez.

¿Quién lo usa?
deps.py (identifica al usuario en cada petición), auth/service.py y users/service.py.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User


class UserRepository:
    """Consultas sobre los usuarios."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos que se usará en las consultas."""
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Busca un usuario por su id interno. Si no existe, devuelve None."""
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        """Busca un usuario por correo. Si no existe, devuelve None."""
        return await self.session.scalar(select(User).where(User.email == email))

    async def get_by_supabase_user_id(self, user_id: uuid.UUID) -> User | None:
        """Busca un usuario por su id de Supabase. Si no existe, devuelve None."""
        return await self.session.scalar(select(User).where(User.supabase_user_id == user_id))

    def add(self, user: User) -> None:
        """Agrega un usuario a la sesión. Todavía no se guarda hasta el commit."""
        self.session.add(user)
