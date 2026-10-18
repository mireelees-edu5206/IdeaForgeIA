import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

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
    hashed = await hash_password("contraseña-segura")
    assert hashed.startswith("$argon2id$")
    assert await verify_password("contraseña-segura", hashed)
    assert not await verify_password("otra", hashed)
    assert not await verify_password("x", "no-es-un-hash")


def test_access_token_roundtrip() -> None:
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
    now = datetime.now(UTC)
    payload = {"sub": str(uuid.uuid4()), "type": "access", "iat": now}
    payload["exp"] = now + timedelta(minutes=5)
    payload.update(payload_changes)
    assert decode_access_token(jwt.encode(payload, SECRET, algorithm=JWT_ALGORITHM), SECRET) is None


def test_token_signed_with_other_secret_rejected() -> None:
    token, _ = create_access_token(uuid.uuid4(), "o" * 40, 30)
    assert decode_access_token(token, SECRET) is None


def test_unsigned_token_rejected() -> None:
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, key=None, algorithm="none")
    assert decode_access_token(token, SECRET) is None


def test_refresh_token_hash_is_sha256_hex() -> None:
    assert len(hash_refresh_token("abc")) == 64


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_login_limiter_blocks_after_max_failures_and_expires() -> None:
    clock = FakeClock()
    limiter = LoginRateLimiter(max_failures=3, window_seconds=60, clock=clock)
    for _ in range(3):
        assert limiter.retry_after("1.1.1.1", "a@x.com") is None
        limiter.register_failure("1.1.1.1", "A@x.com")
    assert limiter.retry_after("1.1.1.1", "a@x.com") == 60
    assert limiter.retry_after("2.2.2.2", "a@x.com") is None  # otra IP no queda bloqueada
    clock.now += 61
    assert limiter.retry_after("1.1.1.1", "a@x.com") is None


def test_login_limiter_blocks_ip_spraying_many_accounts() -> None:
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60, clock=FakeClock())
    for i in range(2 * LoginRateLimiter.IP_MULTIPLIER):
        limiter.register_failure("1.1.1.1", f"user{i}@x.com")
    assert limiter.retry_after("1.1.1.1", "nueva@x.com") is not None


def test_login_limiter_reset_on_success() -> None:
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60, clock=FakeClock())
    limiter.register_failure("1.1.1.1", "a@x.com")
    limiter.reset("1.1.1.1", "a@x.com")
    limiter.register_failure("1.1.1.1", "a@x.com")
    assert limiter.retry_after("1.1.1.1", "a@x.com") is None
