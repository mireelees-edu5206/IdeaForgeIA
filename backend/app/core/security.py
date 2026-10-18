import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from starlette.concurrency import run_in_threadpool

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"

# Argon2id con los parámetros recomendados por RFC 9106 (valores por defecto de argon2-cffi).
_hasher = PasswordHasher()


def _verify(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


@lru_cache
def _dummy_hash() -> str:
    return _hasher.hash(secrets.token_urlsafe(16))


# El hash es costoso a propósito (~decenas de ms): se ejecuta fuera del event loop.
async def hash_password(password: str) -> str:
    return await run_in_threadpool(_hasher.hash, password)


async def verify_password(password: str, password_hash: str) -> bool:
    return await run_in_threadpool(_verify, password_hash, password)


async def verify_against_dummy(password: str) -> None:
    """Iguala el tiempo de respuesta cuando el email no existe (evita enumerar cuentas)."""
    await run_in_threadpool(lambda: _verify(_dummy_hash(), password))


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def create_access_token(user_id: uuid.UUID, secret: str, expires_minutes: int) -> tuple[str, int]:
    """Devuelve (token, segundos hasta que expira)."""
    now = datetime.now(UTC)
    lifetime = timedelta(minutes=expires_minutes)
    payload = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + lifetime,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM), int(lifetime.total_seconds())


def decode_access_token(token: str, secret: str) -> uuid.UUID | None:
    """ID del usuario si el token es válido, vigente y de tipo access; si no, None."""
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "type", "iat", "exp"]},
        )
        if payload["type"] != ACCESS_TOKEN_TYPE:
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
