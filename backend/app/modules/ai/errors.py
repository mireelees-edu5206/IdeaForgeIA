"""Errores tipados de la inteligencia artificial.

ARCHIVO: backend/app/modules/ai/errors.py

¿Qué es?
Una familia de errores para cuando la IA falla. Cada tipo tiene un código fijo (por ejemplo
"ai_timeout") y dice si conviene volver a intentar (retryable).

¿Para qué sirve?
Para que el sistema sepa por qué falló una llamada y decida qué hacer:
- Un timeout o un límite de uso (429) se puede reintentar o cambiar de proveedor.
- Una respuesta con formato inválido no se reintenta igual.

¿Quién lo usa?
- Los proveedores (providers/) lanzan estos errores.
- calls.py los convierte en registros de la bitácora.
- orchestrator.py decide si pasa al proveedor de respaldo.

Importante: el mensaje de estos errores es interno. Nunca se muestra a la persona usuaria; la
pantalla recibe solo el código.
"""

from app.core.enums import AIProviderName
from app.modules.ai.types import AIProviderAttempt


class AIProviderError(Exception):
    """Fallo genérico al llamar al proveedor. Es la clase padre de todos los demás errores de IA.

    Cada error guarda, además del mensaje interno, qué proveedor y modelo fallaron, y la
    lista de intentos hechos hasta ese momento.
    """

    code = "ai_error"  # Código corto que se guarda en la bitácora.
    retryable = False  # False: no conviene reintentar automáticamente.

    def __init__(self, message: str | None = None) -> None:
        """Crea el error con un mensaje interno opcional."""
        super().__init__(message)
        self.provider: AIProviderName | None = None
        self.model: str | None = None
        self.attempts: tuple[AIProviderAttempt, ...] = ()


class AITimeoutError(AIProviderError):
    """La IA tardó más del tiempo permitido. Se puede reintentar."""

    code = "ai_timeout"
    retryable = True


class AIRateLimitError(AIProviderError):
    """El proveedor puso un límite de uso (demasiadas llamadas en poco tiempo). Se puede
    reintentar."""

    code = "ai_rate_limited"
    retryable = True


class AIUnavailableError(AIProviderError):
    """El proveedor no responde o está caído temporalmente. Se puede reintentar."""

    code = "ai_unavailable"
    retryable = True


class AIInvalidResponseError(AIProviderError):
    """La respuesta no cumple el esquema esperado. No se reintenta igual, porque la IA ya
    respondió."""

    code = "ai_invalid_response"


class AIAuthenticationError(AIProviderError):
    """La clave de acceso al proveedor no es válida o no tiene permiso."""

    code = "ai_authentication"


class AIGroundingUnavailableError(AIProviderError):
    """La búsqueda en internet no está disponible, así que no se puede citar fuentes reales."""

    code = "ai_grounding_unavailable"
