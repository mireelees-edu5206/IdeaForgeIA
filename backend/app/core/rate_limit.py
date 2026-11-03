"""Limita los intentos fallidos de inicio de sesión.

ARCHIVO: backend/app/core/rate_limit.py

¿Qué es?
Un contador en memoria que recuerda los intentos fallidos de login. Si alguien falla demasiadas
veces seguidas, el sistema lo bloquea por un rato. Así se evita que adivinen contraseñas.

¿Para qué sirve?
Protege contra dos ataques:
1. Fuerza bruta contra una cuenta concreta (misma IP y mismo correo).
2. Pruebas masivas de muchas cuentas desde una misma IP.

¿Cómo funciona?
- Cada fallo se guarda con la hora en que ocurrió.
- Solo cuentan los fallos de la ventana de tiempo configurada (LOGIN_LOCKOUT_SECONDS).
- Por cuenta: se bloquea con LOGIN_MAX_FAILED_ATTEMPTS intentos.
- Por IP: se bloquea con 4 veces ese número, porque una IP puede tener muchas cuentas.

¿Quién lo usa?
api/deps.py (get_login_limiter) y los routers de login (módulos de autenticación heredada).

Limitación: la memoria vive dentro de un solo proceso. Si el backend corre con varios
procesos o en varias computadoras, cada uno lleva su propio contador. Eso es un pendiente
de la fase de producción.

Cambios comunes:
- Cuántos intentos permitir: LOGIN_MAX_FAILED_ATTEMPTS en backend/.env.
- Cuánto dura el bloqueo: LOGIN_LOCKOUT_SECONDS en backend/.env.
"""

import math
import time
from collections import OrderedDict
from collections.abc import Callable


class _FailureWindow:
    """Guarda los fallos recientes de una clave (una cuenta o una IP) y limita la memoria usada."""

    # Máximo de claves distintas que se recuerdan. Evita que la memoria crezca sin límite
    # si llegan muchos intentos desde muchas IP o correos distintos.
    MAX_TRACKED_KEYS = 10_000
    # Cada cuántos registros se revisan y se borran las claves vencidas.
    PRUNE_INTERVAL = 256

    def __init__(self, max_failures: int, window_seconds: int, clock: Callable[[], float]) -> None:
        """Prepara la ventana.

        - max_failures: cuántos fallos seguidos se permiten antes de bloquear.
        - window_seconds: cuánto tiempo cuenta un fallo.
        - clock: la función que dice la hora actual (en tests se cambia por una falsa).
        """
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        # Diccionario ordenado: clave -> lista con la hora de cada fallo.
        self._failures: OrderedDict[str, list[float]] = OrderedDict()
        self._registrations_since_prune = 0

    def _recent(self, key: str) -> list[float]:
        """Devuelve solo los fallos de la clave que siguen dentro de la ventana de tiempo."""
        # Cualquier fallo más viejo que este límite ya no cuenta.
        cutoff = self._clock() - self.window_seconds
        recent = [t for t in self._failures.get(key, []) if t > cutoff]
        if recent:
            # Guardamos solo los recientes y movemos la clave al final (la usamos hace poco).
            self._failures[key] = recent
            self._failures.move_to_end(key)
        else:
            # Si ya no hay fallos recientes, la clave se borra por completo.
            self._failures.pop(key, None)
        return recent

    def _prune_expired(self) -> None:
        """Revisa todas las claves y borra las que ya no tienen fallos recientes."""
        # "tuple(...)" hace una copia de las claves para poder borrar mientras las recorremos.
        for key in tuple(self._failures):
            self._recent(key)

    def retry_after(self, key: str) -> int | None:
        """Devuelve cuántos segundos faltan para poder intentar otra vez.

        Devuelve None si todavía se puede intentar (no está bloqueado).
        """
        recent = self._recent(key)
        if len(recent) < self.max_failures:
            return None
        # El bloqueo termina cuando vence el fallo más viejo de la lista. Se redondea hacia arriba.
        return max(1, math.ceil(recent[0] + self.window_seconds - self._clock()))

    def register_failure(self, key: str) -> None:
        """Anota un fallo nuevo para la clave."""
        self._recent(key)
        # Si la clave es nueva y ya llegamos al máximo de claves, primero intentamos borrar las
        # vencidas.
        if key not in self._failures and len(self._failures) >= self.MAX_TRACKED_KEYS:
            self._prune_expired()
            # Si aún no hay espacio, se saca la clave más antigua (la que lleva más tiempo sin
            # usarse).
            if len(self._failures) >= self.MAX_TRACKED_KEYS:
                self._failures.popitem(last=False)
        self._failures.setdefault(key, []).append(self._clock())
        self._failures.move_to_end(key)
        self._registrations_since_prune += 1
        # Cada cierto número de fallos, limpiamos las claves vencidas.
        if self._registrations_since_prune >= self.PRUNE_INTERVAL:
            self._prune_expired()
            self._registrations_since_prune = 0

    def reset(self, key: str) -> None:
        """Borra los fallos de la clave (por ejemplo, cuando el login sale bien)."""
        self._failures.pop(key, None)


class LoginRateLimiter:
    """Bloqueo temporal tras intentos de login fallidos.

    Dos límites: por (IP, email) contra fuerza bruta sobre una cuenta, y por IP (4x) contra
    pruebas masivas de cuentas. En memoria: válido para un solo proceso; con varios workers
    o réplicas habrá que moverlo a un almacén compartido (Fase 17).
    """

    # La IP tiene 4 veces más intentos permitidos que una sola cuenta.
    IP_MULTIPLIER = 4

    def __init__(
        self, max_failures: int, window_seconds: int, clock: Callable[[], float] = time.monotonic
    ) -> None:
        """Crea los dos contadores: uno por cuenta y otro por IP."""
        self._per_account = _FailureWindow(max_failures, window_seconds, clock)
        self._per_ip = _FailureWindow(max_failures * self.IP_MULTIPLIER, window_seconds, clock)

    @staticmethod
    def _account_key(ip: str, email: str) -> str:
        """Arma la clave de una cuenta con su IP. El correo se guarda en minúsculas."""
        return f"{ip}|{email.lower()}"

    def retry_after(self, ip: str, email: str) -> int | None:
        """Devuelve los segundos de espera si alguno de los dos límites está activo, o None."""
        waits = [
            self._per_account.retry_after(self._account_key(ip, email)),
            self._per_ip.retry_after(ip),
        ]
        # Si hay varios bloqueos, se devuelve el más largo. "default=None" si ninguno está activo.
        return max((w for w in waits if w is not None), default=None)

    def register_failure(self, ip: str, email: str) -> None:
        """Anota un intento fallido en los dos contadores."""
        self._per_account.register_failure(self._account_key(ip, email))
        self._per_ip.register_failure(ip)

    def reset(self, ip: str, email: str) -> None:
        """Limpia el contador de la cuenta cuando el login sale bien.

        No limpia el contador de la IP, para que una IP que prueba muchas cuentas siga bloqueada.
        """
        self._per_account.reset(self._account_key(ip, email))
