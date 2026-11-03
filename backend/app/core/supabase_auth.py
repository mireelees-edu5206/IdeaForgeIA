"""Valida tokens de Supabase y consulta el estado verificado de la cuenta.

ARCHIVO: backend/app/core/supabase_auth.py

¿Qué es?
El verificador de inicio de sesión con Supabase. Cuando el navegador manda su token (JWT),
este archivo revisa:
1. Que la firma sea válida (con la clave secreta o con la clave pública de Supabase).
2. Que no esté vencido y que sea para la aplicación correcta (audiencia "authenticated").
3. Con Supabase Auth, que el correo esté confirmado (o que la cuenta sea de Google).

¿Para qué sirve?
Para que solo entren personas con una sesión real de Supabase, y para que una cuenta sin correo
confirmado no pueda usar la aplicación.

¿Quién lo usa?
api/deps.py (get_current_user) en cada petición protegida.

Partes importantes:
- SupabaseTokenVerifier.decode: revisa la firma y los datos del token, sin hablar con internet
  (salvo para bajar las claves públicas la primera vez).
- SupabaseTokenVerifier.get_verified_user: pregunta a Supabase por la cuenta y guarda el
  resultado unos 30 segundos, para no preguntar en cada clic.
"""

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

# Algoritmos de firma asimétrica que Supabase puede usar (la clave pública viene de internet).
ALLOWED_ASYMMETRIC_ALGORITHMS = {"ES256", "RS256", "EdDSA"}


class SupabaseTokenError(Exception):
    """El token no es válido. Quien lo recibe responde 401."""

    pass


class SupabaseEmailNotConfirmedError(SupabaseTokenError):
    """La cuenta existe, pero su correo no está confirmado. Quien lo recibe responde 403."""

    pass


class SupabaseAuthUnavailableError(Exception):
    """No se pudo hablar con Supabase (red caída, configuración faltante). Responde 503."""

    pass


class SupabaseTokenVerifier:
    """Verifica el JWT en este equipo y confirma el correo y el proveedor con Supabase Auth."""

    def __init__(self, settings: Settings) -> None:
        """Lee la configuración y prepara el cliente de claves públicas."""
        if settings.supabase_url is None:
            raise ValueError("SUPABASE_URL no está configurada.")
        # El emisor esperado de los tokens: la URL de Supabase con "/auth/v1".
        self.issuer = f"{settings.supabase_url}/auth/v1"
        # Clave secreta (solo para tokens HS256 antiguos). Si no existe, queda None.
        self.secret = (
            settings.supabase_jwt_secret.get_secret_value()
            if settings.supabase_jwt_secret
            else None
        )
        # Clave publicable de Supabase, necesaria para preguntar por la cuenta.
        self.publishable_key = (
            settings.supabase_publishable_key.get_secret_value()
            if settings.supabase_publishable_key
            else None
        )
        # Dirección de las claves públicas. Si no se configuró, se usa la ruta estándar de Supabase.
        jwks_url = settings.supabase_jwks_url or f"{self.issuer}/.well-known/jwks.json"
        # El cliente guarda en caché las claves públicas y espera como máximo 5 segundos.
        self.jwks = PyJWKClient(jwks_url, cache_jwk_set=True, timeout=5)
        # Caché de cuentas verificadas: (id, correo) -> (hasta cuándo vale, datos de la cuenta).
        self._user_cache: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
        # Un candado para que dos hilos no modifiquen la caché al mismo tiempo.
        self._cache_lock = threading.Lock()

    def forget_user(self, user_id: UUID) -> None:
        """Borra de la caché todo lo guardado de esa cuenta (por ejemplo, al eliminarla)."""
        with self._cache_lock:
            self._user_cache = {
                key: value for key, value in self._user_cache.items() if key[0] != str(user_id)
            }

    def decode(self, token: str) -> dict[str, Any]:
        """Revisa la firma y los datos del token. Devuelve sus datos (claims) si todo está bien."""
        try:
            # El encabezado del token dice con qué algoritmo fue firmado.
            algorithm = jwt.get_unverified_header(token).get("alg")
            # La clave se elige con una lista de algoritmos permitidos, nunca desde el token.
            if algorithm == "HS256" and self.secret:
                key = self.secret
            elif algorithm in ALLOWED_ASYMMETRIC_ALGORITHMS:
                # Para firmas asimétricas, la clave pública se baja de Supabase según el token.
                key = self.jwks.get_signing_key_from_jwt(token).key
            else:
                raise SupabaseTokenError("Algoritmo de firma no permitido.")

            claims = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                # La audiencia "authenticated" identifica a los tokens de sesión de usuario.
                audience="authenticated",
                issuer=self.issuer,
                # Estos campos deben estar presentes en el token.
                options={"require": ["sub", "iat", "exp", "aud", "iss"]},
            )
        except SupabaseTokenError:
            raise
        # Cualquier problema de firma, formato o vencimiento se reporta como token no válido.
        except (jwt.PyJWTError, PyJWKClientError, TypeError, ValueError) as exc:
            raise SupabaseTokenError("El token no es válido.") from exc

        # Un token de otro tipo (por ejemplo, de servicio) no sirve para iniciar sesión de usuario.
        if claims.get("role") != "authenticated":
            raise SupabaseTokenError("El token no corresponde a una sesión de usuario.")
        try:
            # El id del usuario debe ser un UUID válido.
            UUID(claims["sub"])
        except (TypeError, ValueError) as exc:
            raise SupabaseTokenError("El identificador del usuario no es válido.") from exc

        email = claims.get("email")
        # El correo debe existir, no estar vacío y tener máximo 254 caracteres (límite del
        # estándar).
        if not isinstance(email, str) or not email.strip() or len(email) > 254:
            raise SupabaseTokenError("El token no incluye un correo válido.")

        return claims

    def get_verified_user(self, token: str, claims: dict[str, Any]) -> dict[str, Any]:
        """Pregunta a Supabase por la cuenta para confirmar correo y proveedor.

        El token estándar no trae si el correo fue confirmado, por eso hay que preguntar.
        Usa caché de 30 segundos para no llamar a Supabase en cada petición.
        """
        if self.publishable_key is None:
            raise SupabaseAuthUnavailableError("SUPABASE_PUBLISHABLE_KEY no está configurada.")
        user_id = claims["sub"]
        email = claims["email"].strip().lower()
        cache_key = (user_id, email)
        now = time.monotonic()
        with self._cache_lock:
            cached = self._user_cache.get(cache_key)
            # Si hay un dato guardado y todavía vale, lo devolvemos sin llamar a Supabase.
            if cached and cached[0] > now:
                return cached[1]
            # Antes de seguir, quitamos de la caché lo que ya venció.
            self._user_cache = {
                key: value for key, value in self._user_cache.items() if value[0] > now
            }

        # Pregunta a Supabase por el usuario actual, usando el mismo token del navegador.
        request = Request(
            f"{self.issuer}/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": self.publishable_key,
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=5) as response:
                user = json.loads(response.read())
        except HTTPError as exc:
            # 401 o 403 de Supabase: el token ya no sirve.
            if exc.code in {401, 403}:
                raise SupabaseTokenError("El token no es válido o ha expirado.") from exc
            raise SupabaseAuthUnavailableError("Supabase Auth no está disponible.") from exc
        # Problemas de red, de tiempo de espera o de respuesta que no es JSON.
        except (URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            raise SupabaseAuthUnavailableError(
                "No se pudo validar la cuenta con Supabase."
            ) from exc

        # Supabase debe devolver la misma cuenta que dice el token (mismo id y mismo correo).
        if (
            not isinstance(user, dict)
            or user.get("id") != user_id
            or not isinstance(user.get("email"), str)
            or user["email"].strip().lower() != email
        ):
            raise SupabaseTokenError("La identidad del token no coincide con la cuenta.")

        # Una cuenta se considera verificada si confirmó el correo o entró con Google.
        app_metadata = user.get("app_metadata")
        google_provider = (
            isinstance(app_metadata, dict) and app_metadata.get("provider") == "google"
        )
        identities = user.get("identities")
        linked_google_identity = isinstance(identities, list) and any(
            isinstance(identity, dict) and identity.get("provider") == "google"
            for identity in identities
        )
        if not user.get("email_confirmed_at") and not (google_provider or linked_google_identity):
            raise SupabaseEmailNotConfirmedError("Confirma tu correo para continuar.")

        # La caché breve reduce consultas repetidas sin conservar perfiles indefinidamente.
        with self._cache_lock:
            # Si la caché llegó a 2048 entradas, se vacía completa para no crecer sin límite.
            if len(self._user_cache) >= 2048:
                self._user_cache.clear()
            self._user_cache[cache_key] = (now + 30, user)
        return user
