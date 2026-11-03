"""Operaciones administrativas de Supabase que requieren la clave privada de servicio.

ARCHIVO: backend/app/core/supabase_admin.py

¿Qué es?
Un cliente pequeño que habla con la API de administración de Supabase. Hoy solo sirve para
borrar una cuenta de Supabase cuando un administrador elimina a alguien desde el panel.

¿Para qué sirve?
Al borrar una cuenta en IdeaForge, también hay que borrarla en Supabase Auth. Si no, la
persona podría seguir entrando con su correo.

¿Quién lo usa?
El módulo de administración (cuando borra una cuenta).

Importante: usa SUPABASE_SERVICE_ROLE_KEY, que es una clave privada con todos los permisos.
Solo vive en el backend. Nunca debe llegar al navegador ni a los logs.
"""

from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from app.core.config import Settings
from app.core.supabase_auth import SupabaseAuthUnavailableError


class SupabaseAdminClient:
    """Cliente que llama a la API de administración de Supabase."""

    def __init__(self, settings: Settings) -> None:
        """Lee la URL de Supabase y la clave de servicio de la configuración."""
        self.url = settings.supabase_url
        # La clave privada está guardada como SecretStr. Aquí se saca su texto real para usarla.
        # Si no está configurada, se guarda None.
        self.key = (
            settings.supabase_service_role_key.get_secret_value()
            if settings.supabase_service_role_key
            else None
        )

    def delete_user(self, user_id: UUID) -> None:
        """Borra la cuenta de Supabase con ese id.

        Si la cuenta ya no existe en Supabase (404), no es un error: el resultado es el mismo.
        Si falta la configuración o Supabase no responde, lanza SupabaseAuthUnavailableError.
        """
        # Sin URL o sin clave, no podemos llamar a Supabase.
        if self.url is None or self.key is None:
            raise SupabaseAuthUnavailableError(
                "SUPABASE_SERVICE_ROLE_KEY es necesaria para eliminar la cuenta de Supabase."
            )
        # La petición DELETE a la ruta de administración del usuario. La clave va en dos
        # encabezados.
        request = Request(
            f"{self.url}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {self.key}",
                "apikey": self.key,
                "Accept": "application/json",
            },
            method="DELETE",
        )
        try:
            # "with" abre la conexión y la cierra al terminar. "timeout=5" evita esperar para
            # siempre.
            with urlopen(request, timeout=5):
                return
        except HTTPError as exc:
            # 404 significa que ya no existe en Supabase: lo tratamos como borrado correcto.
            if exc.code == 404:
                return
            raise SupabaseAuthUnavailableError(
                "Supabase no pudo eliminar la cuenta vinculada."
            ) from exc
        # Problemas de red o de tiempo de espera.
        except (URLError, TimeoutError, OSError) as exc:
            raise SupabaseAuthUnavailableError(
                "No se pudo conectar con Supabase para eliminar la cuenta."
            ) from exc
