"""Pruebas de comportamiento para security."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import rate_limit
from app.core.rate_limit import LoginRateLimiter
from app.core.security import (
    JWT_ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

SECRET = "s" * 40


@pytest.mark.anyio
async def test_password_hash_is_argon2id_and_verifies() -> None:
    """Prueba el escenario: contrasena hash is argon2id and verifies."""
    hashed = await hash_password("contraseña-segura")
    assert hashed.startswith("$argon2id$")
    assert await verify_password("contraseña-segura", hashed)
    assert not await verify_password("otra", hashed)
    assert not await verify_password("x", "no-es-un-hash")


def test_access_token_roundtrip() -> None:
    """Prueba el escenario: access token roundtrip."""
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id, SECRET, 30)
    assert expires_in == 1800
    assert decode_access_token(token, SECRET) == user_id


@pytest.mark.parametrize(
    "payload_changes",
    [
        {"exp": datetime.now(UTC) - timedelta(seconds=1)},  # expirado
        {"type": "refresh"},  # tipo incorrecto
        {"sub": "no-es-uuid"},
    ],
)
def test_invalid_access_tokens_rejected(payload_changes: dict) -> None:
    """Prueba el escenario: invalido access tokens rejected."""
    now = datetime.now(UTC)
    payload = {"sub": str(uuid.uuid4()), "type": "access", "iat": now}
    payload["exp"] = now + timedelta(minutes=5)
    payload.update(payload_changes)
    assert decode_access_token(jwt.encode(payload, SECRET, algorithm=JWT_ALGORITHM), SECRET) is None


def test_token_signed_with_other_secret_rejected() -> None:
    """Prueba el escenario: token signed con otro secret rejected."""
    token, _ = create_access_token(uuid.uuid4(), "o" * 40, 30)
    assert decode_access_token(token, SECRET) is None


def test_unsigned_token_rejected() -> None:
    """Prueba el escenario: unsigned token rejected."""
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, key=None, algorithm="none")
    assert decode_access_token(token, SECRET) is None


def test_refresh_token_hash_is_sha256_hex() -> None:
    """Prueba el escenario: renovacion token hash is sha256 hex."""
    assert len(hash_refresh_token("abc")) == 64


class FakeClock:
    """Representa fake clock."""

    def __init__(self) -> None:
        """Gestiona la inicializacion para pruebas."""
        self.now = 1000.0

    def __call__(self) -> float:
        """Gestiona call para pruebas."""
        return self.now


def test_login_limiter_blocks_after_max_failures_and_expires() -> None:
    """Prueba el escenario: acceso limiter blocks restante maximo failures and expires."""
    clock = FakeClock()
    limiter = LoginRateLimiter(max_failures=3, window_seconds=60, clock=clock)
    # Itera _ sobre range(3).
    for _ in range(3):
        assert limiter.retry_after("1.1.1.1", "a@x.com") is None
        limiter.register_failure("1.1.1.1", "A@x.com")
    assert limiter.retry_after("1.1.1.1", "a@x.com") == 60
    assert limiter.retry_after("2.2.2.2", "a@x.com") is None  # otra IP no queda bloqueada
    clock.now += 61
    assert limiter.retry_after("1.1.1.1", "a@x.com") is None


def test_login_limiter_blocks_ip_spraying_many_accounts() -> None:
    """Prueba el escenario: acceso limiter blocks ip spraying many accounts."""
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60, clock=FakeClock())
    # Itera i sobre range(2 * LoginRateLimiter.IP_MULTIPLIER).
    for i in range(2 * LoginRateLimiter.IP_MULTIPLIER):
        limiter.register_failure("1.1.1.1", f"user{i}@x.com")
    assert limiter.retry_after("1.1.1.1", "nueva@x.com") is not None


def test_login_limiter_reset_on_success() -> None:
    """Prueba el escenario: acceso limiter reset on correcto."""
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60, clock=FakeClock())
    limiter.register_failure("1.1.1.1", "a@x.com")
    limiter.reset("1.1.1.1", "a@x.com")
    limiter.register_failure("1.1.1.1", "a@x.com")
    assert limiter.retry_after("1.1.1.1", "a@x.com") is None


def test_login_limiter_bounds_tracked_keys_and_prunes_expired_keys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Prueba el escenario: acceso limiter bounds tracked claves and prunes expired claves."""
    monkeypatch.setattr(rate_limit._FailureWindow, "MAX_TRACKED_KEYS", 2)
    clock = FakeClock()
    limiter = LoginRateLimiter(max_failures=3, window_seconds=60, clock=clock)

    # Itera index sobre range(3).
    for index in range(3):
        limiter.register_failure(f"192.0.2.{index}", f"user{index}@example.test")

    assert len(limiter._per_account._failures) == 2
    assert len(limiter._per_ip._failures) == 2

    clock.now += 61
    limiter.register_failure("192.0.2.4", "user4@example.test")
    assert len(limiter._per_account._failures) == 1
    assert len(limiter._per_ip._failures) == 1
