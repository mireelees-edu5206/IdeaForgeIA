import math
import time
from collections.abc import Callable


class _FailureWindow:
    def __init__(self, max_failures: int, window_seconds: int, clock: Callable[[], float]) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, list[float]] = {}

    def _recent(self, key: str) -> list[float]:
        cutoff = self._clock() - self.window_seconds
        recent = [t for t in self._failures.get(key, []) if t > cutoff]
        if recent:
            self._failures[key] = recent
        else:
            self._failures.pop(key, None)
        return recent

    def retry_after(self, key: str) -> int | None:
        recent = self._recent(key)
        if len(recent) < self.max_failures:
            return None
        return max(1, math.ceil(recent[0] + self.window_seconds - self._clock()))

    def register_failure(self, key: str) -> None:
        self._recent(key)
        self._failures.setdefault(key, []).append(self._clock())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


class LoginRateLimiter:
    """Bloqueo temporal tras intentos de login fallidos.

    Dos límites: por (IP, email) contra fuerza bruta sobre una cuenta, y por IP (4x) contra
    pruebas masivas de cuentas. En memoria: válido para un solo proceso; con varios workers
    o réplicas habrá que moverlo a un almacén compartido (Fase 17).
    """

    IP_MULTIPLIER = 4

    def __init__(
        self, max_failures: int, window_seconds: int, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._per_account = _FailureWindow(max_failures, window_seconds, clock)
        self._per_ip = _FailureWindow(max_failures * self.IP_MULTIPLIER, window_seconds, clock)

    @staticmethod
    def _account_key(ip: str, email: str) -> str:
        return f"{ip}|{email.lower()}"

    def retry_after(self, ip: str, email: str) -> int | None:
        waits = [
            self._per_account.retry_after(self._account_key(ip, email)),
            self._per_ip.retry_after(ip),
        ]
        return max((w for w in waits if w is not None), default=None)

    def register_failure(self, ip: str, email: str) -> None:
        self._per_account.register_failure(self._account_key(ip, email))
        self._per_ip.register_failure(ip)

    def reset(self, ip: str, email: str) -> None:
        self._per_account.reset(self._account_key(ip, email))
