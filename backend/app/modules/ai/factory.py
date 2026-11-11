"""Construye el adaptador del motor de IA configurado. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/factory.py

¿Qué es?
La fábrica que construye el motor de IA según el archivo de configuración:
- El motor propio de IdeaForge en Python (`engine`: razonamiento, predicción y navegación web).
- El motor de pruebas determinista (`fake`), exclusivo para tests y desarrollo sin red.

¿Para qué sirve?
Para que el resto del sistema reciba un solo objeto (`AIOrchestrator`) que implementa `AIProvider`.
"""

from app.core.config import Settings
from app.core.enums import AIProviderName
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.engine import IdeaForgeEngineProvider
from app.modules.ai.providers.fake import FakeProvider


def build_ai_provider(settings: Settings) -> AIProvider:
    """Crea el motor configurado y lo envuelve en el orquestador."""
    primary = _build(settings.ai_provider, settings)
    fallback = (
        _build(settings.ai_fallback_provider, settings) if settings.ai_fallback_provider else None
    )
    grounded = primary if primary.name in {AIProviderName.ENGINE, AIProviderName.FAKE} else fallback
    return AIOrchestrator(primary, fallback, grounded)


def _build(provider: AIProviderName, settings: Settings) -> AIProvider:
    """Construye una instancia del motor según su identificador."""
    if provider == AIProviderName.FAKE:
        return FakeProvider(latency_ms=settings.ai_fake_latency_ms)
    if provider == AIProviderName.ENGINE:
        return IdeaForgeEngineProvider(
            name=AIProviderName.ENGINE,
            model=settings.ai_engine_model,
            timeout=max(1.0, settings.ai_timeout_seconds - 1),
        )
    raise ValueError("El proveedor histórico no se puede seleccionar.")
