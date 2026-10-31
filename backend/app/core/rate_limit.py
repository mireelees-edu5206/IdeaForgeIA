"""Utilidad de soporte. Area: aplicacion."""

import math
import time
from collections import OrderedDict
from collections.abc import Callable


class _FailureWindow:
    """Guarda fallos recientes y acota la memoria usada por claves de acceso."""

    # Prevent unique IP/email attempts from growing the in-process limiter without bound.
    MAX_TRACKED_KEYS = 10_000
    PRUNE_INTERVAL = 256

    def __init__(self, max_failures: int, window_seconds: int, clock: Callable[[], float]) -> None:
        """Gestiona la inicializacion para aplicacion."""
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: OrderedDict[str, list[float]] = OrderedDict()
        self._registrations_since_prune = 0

    def _recent(self, key: str) -> list[float]:
        """Conserva solo intentos que siguen dentro de la ventana activa."""
        cutoff = self._clock() - self.window_seconds
        recent = [t for t in self._failures.get(key, []) if t > cutoff]
        # Rama condicional: se cumple recent.
        if recent:
            self._failures[key] = recent
            self._failures.move_to_end(key)
        else:
            self._failures.pop(key, None)
        return recent

    def _prune_expired(self) -> None:
        """Retira claves cuyos intentos ya vencieron."""
        # Itera key sobre tuple(self._failures).
        for key in tuple(self._failures):
            self._recent(key)

    def retry_after(self, key: str) -> int | None:
        """Calcula segundos restantes antes de permitir otro intento."""
        recent = self._recent(key)
        # Rama condicional: se cumple len(recent) < self.max_failures.
        if len(recent) < self.max_failures:
            return None
        return max(1, math.ceil(recent[0] + self.window_seconds - self._clock()))

    def register_failure(self, key: str) -> None:
        """Registra fallo."""
        self._recent(key)
        # Rama condicional: evalua key not in self._failures and len(self._failures) >=
        # self.MAX_TRACKED_KE.
        if key not in self._failures and len(self._failures) >= self.MAX_TRACKED_KEYS:
            self._prune_expired()
            # Rama condicional: se cumple len(self._failures) >= self.MAX_TRACKED_KEYS.
            if len(self._failures) >= self.MAX_TRACKED_KEYS:
                self._failures.popitem(last=False)
        self._failures.setdefault(key, []).append(self._clock())
        self._failures.move_to_end(key)
        self._registrations_since_prune += 1
        # Rama condicional: se cumple self._registrations_since_prune >= self.PRUNE_INTERVAL.
        if self._registrations_since_prune >= self.PRUNE_INTERVAL:
            self._prune_expired()
            self._registrations_since_prune = 0

    def reset(self, key: str) -> None:
        """Reinicia el flujo principal."""
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
        """Gestiona la inicializacion para aplicacion."""
        self._per_account = _FailureWindow(max_failures, window_seconds, clock)
        self._per_ip = _FailureWindow(max_failures * self.IP_MULTIPLIER, window_seconds, clock)

    @staticmethod
    def _account_key(ip: str, email: str) -> str:
        """Gestiona account clave."""
        return f"{ip}|{email.lower()}"

    def retry_after(self, ip: str, email: str) -> int | None:
        """Gestiona retry restante."""
        waits = [
            self._per_account.retry_after(self._account_key(ip, email)),
            self._per_ip.retry_after(ip),
        ]
        return max((w for w in waits if w is not None), default=None)

    def register_failure(self, ip: str, email: str) -> None:
        """Registra fallo."""
        self._per_account.register_failure(self._account_key(ip, email))
        self._per_ip.register_failure(ip)

    def reset(self, ip: str, email: str) -> None:
        """Reinicia el flujo principal."""
        self._per_account.reset(self._account_key(ip, email))
