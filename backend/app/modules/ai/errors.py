"""Declara errores tipados del dominio. Area: proveedores de IA."""

from app.core.enums import AIProviderName
from app.modules.ai.types import AIProviderAttempt


class AIProviderError(Exception):
    """Fallo al llamar al proveedor. El mensaje es interno: nunca se envía al cliente."""

    code = "ai_error"
    retryable = False

    def __init__(self, message: str | None = None) -> None:
        """Gestiona la inicializacion para inteligencia artificial."""
        super().__init__(message)
        self.provider: AIProviderName | None = None
        self.model: str | None = None
        self.attempts: tuple[AIProviderAttempt, ...] = ()


class AITimeoutError(AIProviderError):
    """Error que representa aitimeout."""

    code = "ai_timeout"
    retryable = True


class AIRateLimitError(AIProviderError):
    """Error que representa airate limite."""

    code = "ai_rate_limited"
    retryable = True


class AIUnavailableError(AIProviderError):
    """Error que representa aiunavailable."""

    code = "ai_unavailable"
    retryable = True


class AIInvalidResponseError(AIProviderError):
    """La respuesta no cumple el esquema esperado."""

    code = "ai_invalid_response"


class AIAuthenticationError(AIProviderError):
    """Error que representa aiauthentication."""

    code = "ai_authentication"


class AIGroundingUnavailableError(AIProviderError):
    """Error que representa aigrounding unavailable."""

    code = "ai_grounding_unavailable"
