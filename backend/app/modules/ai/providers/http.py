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
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        if exc.code == 429:
            raise AIRateLimitError() from None
        if exc.code in {401, 403}:
            raise AIAuthenticationError() from None
        if exc.code in {408, 504}:
            raise AITimeoutError() from None
        if exc.code >= 500:
            raise AIUnavailableError() from None
        raise AIProviderError() from None
    except TimeoutError:
        raise AITimeoutError() from None
    except URLError as exc:
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            raise AITimeoutError() from None
        raise AIUnavailableError() from None
    except OSError:
        raise AIUnavailableError() from None

    if len(body) > MAX_RESPONSE_BYTES:
        raise AIProviderError()
    try:
        result = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AIProviderError() from None
    if not isinstance(result, dict):
        raise AIProviderError()
    return result


async def post_json(
    url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float
) -> dict[str, Any]:
    return await asyncio.to_thread(_post_json_sync, url, payload, headers, timeout)
