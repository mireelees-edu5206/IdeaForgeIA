from app.core.config import Settings
from app.core.enums import AIProviderName
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.providers.gemini import GeminiProvider
from app.modules.ai.providers.ollama import OllamaProvider


def build_ai_provider(settings: Settings) -> AIProvider:
    """Construye proveedores configurados; el resto de la aplicación usa solo AIProvider."""
    primary = _build(settings.ai_provider, settings)
    fallback = (
        _build(settings.ai_fallback_provider, settings) if settings.ai_fallback_provider else None
    )
    grounded = primary if primary.name in {AIProviderName.GEMINI, AIProviderName.FAKE} else None
    if grounded is None and settings.gemini_search_grounding_enabled and settings.gemini_api_key:
        grounded = (
            fallback
            if fallback and fallback.name == AIProviderName.GEMINI
            else _build_gemini(settings)
        )
    return AIOrchestrator(primary, fallback, grounded)


def _build(provider: AIProviderName, settings: Settings) -> AIProvider:
    if provider == AIProviderName.FAKE:
        return FakeProvider(latency_ms=settings.ai_fake_latency_ms)
    if provider == AIProviderName.GEMINI:
        return _build_gemini(settings)
    if provider == AIProviderName.OLLAMA:
        return OllamaProvider(
            settings.ollama_base_url,
            settings.ollama_model,
            settings.ai_timeout_seconds - 1,
            settings.ollama_think,
        )
    raise ValueError("El proveedor histórico no se puede seleccionar.")


def _build_gemini(settings: Settings) -> GeminiProvider:
    if settings.gemini_api_key is None:
        raise ValueError("GEMINI_API_KEY es obligatoria para Gemini.")
    return GeminiProvider(
        settings.gemini_api_key.get_secret_value(),
        settings.gemini_model,
        settings.ai_timeout_seconds - 1,
        settings.gemini_search_grounding_enabled,
    )
