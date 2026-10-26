from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from app.core.config import Settings
from app.core.supabase_auth import SupabaseAuthUnavailableError


class SupabaseAdminClient:
    def __init__(self, settings: Settings) -> None:
        self.url = settings.supabase_url
        self.key = (
            settings.supabase_service_role_key.get_secret_value()
            if settings.supabase_service_role_key
            else None
        )

    def delete_user(self, user_id: UUID) -> None:
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
        try:
            with urlopen(request, timeout=5):
                return
        except HTTPError as exc:
            if exc.code == 404:
                return
            raise SupabaseAuthUnavailableError(
                "Supabase no pudo eliminar la cuenta vinculada."
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise SupabaseAuthUnavailableError(
                "No se pudo conectar con Supabase para eliminar la cuenta."
            ) from exc
