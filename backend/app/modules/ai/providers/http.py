"""Utilidad de soporte. Area: proveedores de IA."""

import asyncio
import json
import socket
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.modules.ai.errors import (
    AIAuthenticationError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
    AIUnavailableError,
)

MAX_RESPONSE_BYTES = 10_000_000


def _post_json_sync(
    url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float
) -> dict[str, Any]:
    """Gestiona post json sync."""
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    # Protege la operacion y dirige sus errores a manejadores explicitos.
    try:
        # Abre y libera los recursos declarados en este bloque.
        with urlopen(request, timeout=timeout) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
    # Maneja el error HTTPError sin detener el flujo esperado.
    except HTTPError as exc:
        # Rama condicional: se cumple exc.code == 429.
        if exc.code == 429:
            raise AIRateLimitError() from None
        # Rama condicional: se cumple exc.code in {401, 403}.
        if exc.code in {401, 403}:
            raise AIAuthenticationError() from None
        # Rama condicional: se cumple exc.code in {408, 504}.
        if exc.code in {408, 504}:
            raise AITimeoutError() from None
        # Rama condicional: se cumple exc.code >= 500.
        if exc.code >= 500:
            raise AIUnavailableError() from None
        raise AIProviderError() from None
    # Maneja el error TimeoutError sin detener el flujo esperado.
    except TimeoutError:
        raise AITimeoutError() from None
    # Maneja el error URLError sin detener el flujo esperado.
    except URLError as exc:
        # Rama condicional: se cumple isinstance(exc.reason, (TimeoutError, socket.timeout)).
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            raise AITimeoutError() from None
        raise AIUnavailableError() from None
    # Maneja el error OSError sin detener el flujo esperado.
    except OSError:
        raise AIUnavailableError() from None

    # Rama condicional: se cumple len(body) > MAX_RESPONSE_BYTES.
    if len(body) > MAX_RESPONSE_BYTES:
        raise AIProviderError()
    # Protege la operacion y dirige sus errores a manejadores explicitos.
    try:
        result = json.loads(body)
    # Maneja el error (UnicodeDecodeError, json.JSONDecodeError) sin detener el flujo esperado.
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AIProviderError() from None
    # Rama condicional: se cumple not isinstance(result, dict).
    if not isinstance(result, dict):
        raise AIProviderError()
    return result


async def post_json(
    url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float
) -> dict[str, Any]:
    """Gestiona post json."""
    return await asyncio.to_thread(_post_json_sync, url, payload, headers, timeout)
