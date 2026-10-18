from app.core.enums import AIProviderName
from app.modules.ai.types import AIProviderAttempt


class AIProviderError(Exception):
    """Fallo al llamar al proveedor. El mensaje es interno: nunca se envía al cliente."""

    code = "ai_error"
    retryable = False

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message)
        self.provider: AIProviderName | None = None
        self.model: str | None = None
        self.attempts: tuple[AIProviderAttempt, ...] = ()


class AITimeoutError(AIProviderError):
    code = "ai_timeout"
    retryable = True


class AIRateLimitError(AIProviderError):
    code = "ai_rate_limited"
    retryable = True


class AIUnavailableError(AIProviderError):
    code = "ai_unavailable"
    retryable = True


class AIInvalidResponseError(AIProviderError):
    """La respuesta no cumple el esquema esperado."""

    code = "ai_invalid_response"


class AIAuthenticationError(AIProviderError):
    code = "ai_authentication"


class AIGroundingUnavailableError(AIProviderError):
    code = "ai_grounding_unavailable"
