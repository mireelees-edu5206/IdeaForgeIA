"""Construye el adaptador configurado. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/factory.py

¿Qué es?
La fábrica que decide qué proveedores de IA usar según el archivo de configuración:
- El proveedor principal (AI_PROVIDER): gemini, ollama o fake (de prueba).
- El proveedor de respaldo (AI_FALLBACK_PROVIDER), opcional.
- El proveedor que busca en internet (Gemini con grounding), si está configurado.

¿Para qué sirve?
Para que el resto del sistema reciba un solo objeto (AIOrchestrator) y no tenga que saber qué
proveedor está detrás.

¿Quién lo usa?
main.py, al crear la aplicación.

Cambios comunes:
- Cambiar de proveedor: AI_PROVIDER en backend/.env (gemini, ollama o fake).
- Agregar respaldo: AI_FALLBACK_PROVIDER en backend/.env (distinto del principal).
"""

from app.core.config import Settings
from app.core.enums import AIProviderName
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.fake import FakeProvider
from app.modules.ai.providers.gemini import GeminiProvider
from app.modules.ai.providers.ollama import OllamaProvider


def build_ai_provider(settings: Settings) -> AIProvider:
    """Crea los proveedores configurados y los une en un orquestador.

    El resto de la aplicación usa solo la interfaz AIProvider, sin importar cuál sea.
    """
    primary = _build(settings.ai_provider, settings)
    fallback = (
        _build(settings.ai_fallback_provider, settings) if settings.ai_fallback_provider else None
    )
    # El proveedor que busca en internet: el principal si ya es Gemini o de prueba.
    grounded = primary if primary.name in {AIProviderName.GEMINI, AIProviderName.FAKE} else None
    # Si ninguno sirve para buscar, y la búsqueda con Gemini está activa con clave, se crea uno
    # aparte.
    if grounded is None and settings.gemini_search_grounding_enabled and settings.gemini_api_key:
        grounded = (
            fallback
            if fallback and fallback.name == AIProviderName.GEMINI
            else _build_gemini(settings)
        )
    return AIOrchestrator(primary, fallback, grounded)


def _build(provider: AIProviderName, settings: Settings) -> AIProvider:
    """Crea un proveedor según su nombre. El nombre "legacy" no se puede seleccionar."""
    if provider == AIProviderName.FAKE:
        # El proveedor de prueba responde con datos fijos, con una pausa simulada.
        return FakeProvider(latency_ms=settings.ai_fake_latency_ms)
    if provider == AIProviderName.GEMINI:
        return _build_gemini(settings)
    if provider == AIProviderName.OLLAMA:
        # Se restan 1 segundo al tiempo límite para que el proveedor corte antes que el sistema.
        return OllamaProvider(
            settings.ollama_base_url,
            settings.ollama_model,
            settings.ai_timeout_seconds - 1,
            settings.ollama_think,
        )
    raise ValueError("El proveedor histórico no se puede seleccionar.")


def _build_gemini(settings: Settings) -> GeminiProvider:
    """Crea el proveedor de Gemini. Necesita GEMINI_API_KEY; si falta, lanza un error."""
    if settings.gemini_api_key is None:
        raise ValueError("GEMINI_API_KEY es obligatoria para Gemini.")
    return GeminiProvider(
        settings.gemini_api_key.get_secret_value(),
        settings.gemini_model,
        settings.ai_timeout_seconds - 1,
        settings.gemini_search_grounding_enabled,
    )
