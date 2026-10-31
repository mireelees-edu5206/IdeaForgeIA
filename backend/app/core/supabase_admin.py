"""Operaciones administrativas de Supabase que requieren la clave privada de servicio."""

from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from app.core.config import Settings
from app.core.supabase_auth import SupabaseAuthUnavailableError


class SupabaseAdminClient:
    """Representa supabase administrador client."""

    def __init__(self, settings: Settings) -> None:
        """Gestiona la inicializacion para aplicacion."""
        self.url = settings.supabase_url
        self.key = (
            settings.supabase_service_role_key.get_secret_value()
            if settings.supabase_service_role_key
            else None
        )

    def delete_user(self, user_id: UUID) -> None:
        """Elimina usuario."""
        # Rama condicional: se cumple self.url is None or self.key is None.
        if self.url is None or self.key is None:
            raise SupabaseAuthUnavailableError(
                "SUPABASE_SERVICE_ROLE_KEY es necesaria para eliminar la cuenta de Supabase."
            )
        request = Request(
            f"{self.url}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {self.key}",
                "apikey": self.key,
                "Accept": "application/json",
            },
            method="DELETE",
        )
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            # Abre y libera los recursos declarados en este bloque.
            with urlopen(request, timeout=5):
                return
        # Maneja el error HTTPError sin detener el flujo esperado.
        except HTTPError as exc:
            # Rama condicional: se cumple exc.code == 404.
            if exc.code == 404:
                return
            raise SupabaseAuthUnavailableError(
                "Supabase no pudo eliminar la cuenta vinculada."
            ) from exc
        # Maneja el error (URLError, TimeoutError, OSError) sin detener el flujo esperado.
        except (URLError, TimeoutError, OSError) as exc:
            raise SupabaseAuthUnavailableError(
                "No se pudo conectar con Supabase para eliminar la cuenta."
            ) from exc
