"""Valida tokens Supabase y consulta el estado verificado de la cuenta."""

import json
import threading
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError

from app.core.config import Settings

ALLOWED_ASYMMETRIC_ALGORITHMS = {"ES256", "RS256", "EdDSA"}


class SupabaseTokenError(Exception):
    """Error que representa supabase token."""

    pass


class SupabaseEmailNotConfirmedError(SupabaseTokenError):
    """Error que representa supabase correo no confirmed."""

    pass


class SupabaseAuthUnavailableError(Exception):
    """Error que representa supabase autenticacion unavailable."""

    pass


class SupabaseTokenVerifier:
    """Verifica JWT localmente y confirma correo/proveedor con Supabase Auth."""

    def __init__(self, settings: Settings) -> None:
        """Gestiona la inicializacion para aplicacion."""
        # Rama condicional: se cumple settings.supabase_url is None.
        if settings.supabase_url is None:
            raise ValueError("SUPABASE_URL no está configurada.")
        self.issuer = f"{settings.supabase_url}/auth/v1"
        self.secret = (
            settings.supabase_jwt_secret.get_secret_value()
            if settings.supabase_jwt_secret
            else None
        )
        self.publishable_key = (
            settings.supabase_publishable_key.get_secret_value()
            if settings.supabase_publishable_key
            else None
        )
        jwks_url = settings.supabase_jwks_url or f"{self.issuer}/.well-known/jwks.json"
        self.jwks = PyJWKClient(jwks_url, cache_jwk_set=True, timeout=5)
        self._user_cache: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
        self._cache_lock = threading.Lock()

    def forget_user(self, user_id: UUID) -> None:
        """Gestiona forget usuario."""
        # Abre y libera los recursos declarados en este bloque.
        with self._cache_lock:
            self._user_cache = {
                key: value for key, value in self._user_cache.items() if key[0] != str(user_id)
            }

    def decode(self, token: str) -> dict[str, Any]:
        """Decodifica el flujo principal."""
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            algorithm = jwt.get_unverified_header(token).get("alg")
            # La clave se elige con una lista de algoritmos permitidos, nunca desde el token.
            if algorithm == "HS256" and self.secret:
                key = self.secret
            # Rama condicional: se cumple algorithm in ALLOWED_ASYMMETRIC_ALGORITHMS.
            elif algorithm in ALLOWED_ASYMMETRIC_ALGORITHMS:
                key = self.jwks.get_signing_key_from_jwt(token).key
            else:
                raise SupabaseTokenError("Algoritmo de firma no permitido.")

            claims = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience="authenticated",
                issuer=self.issuer,
                options={"require": ["sub", "iat", "exp", "aud", "iss"]},
            )
        # Maneja el error SupabaseTokenError sin detener el flujo esperado.
        except SupabaseTokenError:
            raise
        # Maneja el error (jwt.PyJWTError, PyJWKClientError, TypeError, ValueError) sin detener el
        # flujo esperado.
        except (jwt.PyJWTError, PyJWKClientError, TypeError, ValueError) as exc:
            raise SupabaseTokenError("El token no es válido.") from exc

        # Rama condicional: se cumple claims.get('role') != 'authenticated'.
        if claims.get("role") != "authenticated":
            raise SupabaseTokenError("El token no corresponde a una sesión de usuario.")
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            UUID(claims["sub"])
        # Maneja el error (TypeError, ValueError) sin detener el flujo esperado.
        except (TypeError, ValueError) as exc:
            raise SupabaseTokenError("El identificador del usuario no es válido.") from exc

        email = claims.get("email")
        # Rama condicional: evalua not isinstance(email, str) or not email.strip() or len(email) >
        # 254.
        if not isinstance(email, str) or not email.strip() or len(email) > 254:
            raise SupabaseTokenError("El token no incluye un correo válido.")

        return claims

    def get_verified_user(self, token: str, claims: dict[str, Any]) -> dict[str, Any]:
        """Confirma email y proveedor con Auth; el JWT estándar no contiene esos datos."""
        # Rama condicional: se cumple self.publishable_key is None.
        if self.publishable_key is None:
            raise SupabaseAuthUnavailableError("SUPABASE_PUBLISHABLE_KEY no está configurada.")
        user_id = claims["sub"]
        email = claims["email"].strip().lower()
        cache_key = (user_id, email)
        now = time.monotonic()
        # Abre y libera los recursos declarados en este bloque.
        with self._cache_lock:
            cached = self._user_cache.get(cache_key)
            # Rama condicional: se cumple cached and cached[0] > now.
            if cached and cached[0] > now:
                return cached[1]
            self._user_cache = {
                key: value for key, value in self._user_cache.items() if value[0] > now
            }

        request = Request(
            f"{self.issuer}/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": self.publishable_key,
                "Accept": "application/json",
            },
        )
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            # Abre y libera los recursos declarados en este bloque.
            with urlopen(request, timeout=5) as response:
                user = json.loads(response.read())
        # Maneja el error HTTPError sin detener el flujo esperado.
        except HTTPError as exc:
            # Rama condicional: se cumple exc.code in {401, 403}.
            if exc.code in {401, 403}:
                raise SupabaseTokenError("El token no es válido o ha expirado.") from exc
            raise SupabaseAuthUnavailableError("Supabase Auth no está disponible.") from exc
        # Maneja el error (URLError, TimeoutError, json.JSONDecodeError, OSError) sin detener el
        # flujo esperado.
        except (URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            raise SupabaseAuthUnavailableError(
                "No se pudo validar la cuenta con Supabase."
            ) from exc

        # Rama condicional: evalua not isinstance(user, dict) or user.get(un valor) != user_id or
        # (not isin.
        if (
            not isinstance(user, dict)
            or user.get("id") != user_id
            or not isinstance(user.get("email"), str)
            or user["email"].strip().lower() != email
        ):
            raise SupabaseTokenError("La identidad del token no coincide con la cuenta.")

        app_metadata = user.get("app_metadata")
        google_provider = (
            isinstance(app_metadata, dict) and app_metadata.get("provider") == "google"
        )
        identities = user.get("identities")
        linked_google_identity = isinstance(identities, list) and any(
            isinstance(identity, dict) and identity.get("provider") == "google"
            for identity in identities
        )
        # Rama condicional: evalua not user.get(un valor) and (not (google_provider or
        # linked_google_identi.
        if not user.get("email_confirmed_at") and not (google_provider or linked_google_identity):
            raise SupabaseEmailNotConfirmedError("Confirma tu correo para continuar.")

        # La caché breve reduce consultas repetidas sin conservar perfiles indefinidamente.
        with self._cache_lock:
            # Rama condicional: se cumple len(self._user_cache) >= 2048.
            if len(self._user_cache) >= 2048:
                self._user_cache.clear()
            self._user_cache[cache_key] = (now + 30, user)
        return user
