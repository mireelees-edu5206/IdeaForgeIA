"""Utilidad de soporte. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/providers/http.py

¿Qué es?
Una función pequeña que manda una petición POST con datos en formato JSON a un servidor de IA
y devuelve la respuesta ya convertida en un diccionario.

¿Para qué sirve?
Para no repetir el mismo código de red en cada proveedor. Además, traduce los errores de red y
del servidor en los errores de IA del sistema (límite de uso, tiempo de espera, clave inválida).

¿Quién lo usa?
ollama.py y gemini.py para hablar con sus servidores.

Partes importantes:
- Se ejecuta en otro hilo (asyncio.to_thread) para no bloquear el resto del servidor.
- Limita el tamaño de la respuesta a 10 MB, para no llenar la memoria con una respuesta enorme.
"""

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

# Tamaño máximo de la respuesta: 10 millones de bytes (unos 10 MB).
MAX_RESPONSE_BYTES = 10_000_000


def _post_json_sync(
    url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float
) -> dict[str, Any]:
    """Hace la petición POST de forma bloqueante y devuelve la respuesta como diccionario.

    Traduce cada tipo de error HTTP o de red a su error de IA correspondiente.
    """
    # El cuerpo se convierte a JSON en UTF-8, conservando acentos (ensure_ascii=False).
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        # Se leen como máximo MAX_RESPONSE_BYTES + 1 bytes: el +1 sirve para detectar respuestas
        # enormes.
        with urlopen(request, timeout=timeout) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        # 429: demasiadas llamadas. Límite de uso.
        if exc.code == 429:
            raise AIRateLimitError() from None
        # 401 o 403: la clave no es válida o no tiene permiso.
        if exc.code in {401, 403}:
            raise AIAuthenticationError() from None
        # 408 o 504: el servidor tardó demasiado.
        if exc.code in {408, 504}:
            raise AITimeoutError() from None
        # 500 en adelante: el servidor tuvo un fallo.
        if exc.code >= 500:
            raise AIUnavailableError() from None
        raise AIProviderError() from None
    except TimeoutError:
        raise AITimeoutError() from None
    except URLError as exc:
        # Si la razón del fallo es un tiempo de espera, es timeout; si no, el servicio no está
        # disponible.
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            raise AITimeoutError() from None
        raise AIUnavailableError() from None
    except OSError:
        raise AIUnavailableError() from None

    # Si la respuesta pasó del límite de tamaño, se rechaza.
    if len(body) > MAX_RESPONSE_BYTES:
        raise AIProviderError()
    try:
        result = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AIProviderError() from None
    # La respuesta debe ser un objeto JSON (diccionario), no una lista ni un número.
    if not isinstance(result, dict):
        raise AIProviderError()
    return result


async def post_json(
    url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float
) -> dict[str, Any]:
    """Versión asíncrona de la petición: la ejecuta en otro hilo para no bloquear el servidor."""
    return await asyncio.to_thread(_post_json_sync, url, payload, headers, timeout)
