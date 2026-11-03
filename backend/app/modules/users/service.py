"""Aplica reglas de negocio y permisos. Area: perfiles.

ARCHIVO: backend/app/modules/users/service.py

¿Qué es?
La regla del perfil: cambiar el nombre de la persona conectada.

¿Para qué sirve?
Para que cada quien solo pueda cambiar sus propios datos. El cambio de contraseña vive en
auth/service.py, porque necesita revisar la contraseña actual.

¿Quién lo usa?
users/router.py (PATCH /users/me).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from app.modules.users.schemas import UserUpdate


class UserService:
    """Reglas del perfil de cada persona."""

    def __init__(self, session: AsyncSession) -> None:
        """Guarda la sesión de base de datos de esta petición."""
        self.session = session

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        """Cambia el nombre de la persona y guarda el cambio."""
        user.full_name = data.full_name
        await self.session.commit()
        return user
