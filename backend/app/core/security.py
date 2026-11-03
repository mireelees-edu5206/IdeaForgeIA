"""Funciones de seguridad: contraseñas, tokens de acceso y tokens de renovación.

ARCHIVO: backend/app/core/security.py

¿Qué es?
El conjunto de herramientas criptográficas del backend:
- Contraseñas: se guardan como "hash" (una huella irreversible) con Argon2, nunca en texto.
- Tokens de acceso: un JWT firmado (una tarjeta digital con fecha de vencimiento) para la
  autenticación heredada.
- Tokens de renovación: texto aleatorio que se guarda como huella SHA-256.

¿Para qué sirve?
Para que nadie pueda leer una contraseña guardada, y para que un token falso o vencido se rechace.

¿Quién lo usa?
- deps.py: decodifica el token de acceso en cada petición (solo con auth heredada).
- Módulos de auth y usuarios: crean y verifican contraseñas y tokens.

Detalles importantes:
- Argon2 es lento a propósito. Por eso las funciones async lo ejecutan en otro hilo.
- Los hashes se comparan con argon2, que evita ataques de tiempo.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from starlette.concurrency import run_in_threadpool

# Algoritmo de firma del JWT. HS256 usa una clave secreta compartida.
JWT_ALGORITHM = "HS256"
# Valor de "type" que identifica a un token de acceso (y evita usar otro tipo de token).
ACCESS_TOKEN_TYPE = "access"

# Argon2id con los parámetros recomendados por RFC 9106 (valores por defecto de argon2-cffi).
_hasher = PasswordHasher()


def _verify(password_hash: str, password: str) -> bool:
    """Revisa si la contraseña coincide con el hash. Devuelve False si el hash está dañado."""
    try:
        return _hasher.verify(password_hash, password)
    # Si la contraseña no coincide, Argon2 lanza VerificationError. Un hash mal formado,
    # InvalidHashError.
    except (VerificationError, InvalidHashError):
        return False


@lru_cache
def _dummy_hash() -> str:
    """Crea un hash falso una sola vez y lo reutiliza.

    Se usa cuando el correo no existe: así la respuesta tarda lo mismo y nadie puede adivinar
    qué correos están registrados.
    """
    return _hasher.hash(secrets.token_urlsafe(16))


# El hash es costoso a propósito (~decenas de ms): se ejecuta fuera del event loop.
async def hash_password(password: str) -> str:
    """Convierte una contraseña en su hash para guardarla de forma segura."""
    return await run_in_threadpool(_hasher.hash, password)


async def verify_password(password: str, password_hash: str) -> bool:
    """Devuelve True si la contraseña coincide con su hash guardado."""
    return await run_in_threadpool(_verify, password_hash, password)


async def verify_against_dummy(password: str) -> None:
    """Iguala el tiempo de respuesta cuando el email no existe (evita enumerar cuentas)."""
    # La lambda hace la verificación contra el hash falso. El resultado no importa; solo el tiempo.
    await run_in_threadpool(lambda: _verify(_dummy_hash(), password))


def password_needs_rehash(password_hash: str) -> bool:
    """Indica si el hash guardado usa parámetros viejos y conviene recalcularlo."""
    return _hasher.check_needs_rehash(password_hash)


def create_access_token(user_id: uuid.UUID, secret: str, expires_minutes: int) -> tuple[str, int]:
    """Crea un token de acceso firmado para el usuario.

    Devuelve (token, segundos hasta que expira).
    """
    now = datetime.now(UTC)
    lifetime = timedelta(minutes=expires_minutes)
    payload = {
        "sub": str(user_id),  # Quién es el usuario.
        "type": ACCESS_TOKEN_TYPE,  # Para qué sirve el token.
        "iat": now,  # Cuándo se creó.
        "exp": now + lifetime,  # Cuándo vence.
        "jti": uuid.uuid4().hex,  # Identificador único del token.
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM), int(lifetime.total_seconds())


def decode_access_token(token: str, secret: str) -> uuid.UUID | None:
    """Devuelve el id del usuario si el token es válido, vigente y de tipo acceso. Si no, None."""
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            # Estos campos deben existir. Si falta alguno, el token se rechaza.
            options={"require": ["sub", "type", "iat", "exp"]},
        )
        # Un token de otro tipo (por ejemplo, de renovación) no sirve para entrar.
        if payload["type"] != ACCESS_TOKEN_TYPE:
            return None
        return uuid.UUID(payload["sub"])
    # Cualquier error de firma, de vencimiento o de formato significa "token no válido".
    except (jwt.PyJWTError, ValueError):
        return None


def generate_refresh_token() -> str:
    """Crea un token de renovación aleatorio y largo (64 caracteres aproximadamente)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Convierte el token de renovación en una huella SHA-256 para guardarlo sin exponerlo."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
