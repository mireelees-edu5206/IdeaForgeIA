"""Aplica reglas de negocio y permisos. Area: perfiles."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from app.modules.users.schemas import UserUpdate


class UserService:
    """Servicio de reglas de negocio para usuario."""

    def __init__(self, session: AsyncSession) -> None:
        """Gestiona la inicializacion para usuarios."""
        self.session = session

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        """Actualiza profile."""
        user.full_name = data.full_name
        await self.session.commit()
        return user
