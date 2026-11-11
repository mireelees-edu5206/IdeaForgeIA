# ARCHIVO: backend/app/modules/ai/orchestrator.py
#
# ¿Qué es?
# El "director" de la inteligencia artificial. Recibe una petición y decide qué proveedor la
# atiende: primero el principal; si falla con un error que vale la pena reintentar, pasa al de
# respaldo. Para las búsquedas en internet usa el proveedor que sí puede buscar.
#
# ¿Para qué sirve?
# Para que la investigación no se caiga por un solo proveedor. Además, deja registrados todos los
# intentos (quién respondió, cuánto tardó, qué error hubo) para la bitácora.
#
# ¿Quién lo usa?
# factory.py lo construye. El resto del sistema lo usa como si fuera un solo proveedor.
#
# Reglas de respaldo:
# - Datos estructurados: si el principal falla y el error permite reintentar (timeout, límite de
#   uso, servicio caído), se intenta el respaldo. Si no hay respaldo, el error sube tal cual.
# - Búsqueda en internet: solo se cambia de proveedor si el error es de límite de uso (429).

"""Utilidad de soporte. Area: proveedores de IA."""

import time
from collections.abc import Sequence
from dataclasses import replace
from decimal import Decimal

from pydantic import BaseModel

from app.core.enums import AIProviderName
from app.modules.ai.errors import AIGroundingUnavailableError, AIProviderError, AIRateLimitError
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.types import (
    AIMessage,
    AIProviderAttempt,
    AIUsage,
    GroundedResult,
    StructuredResult,
)


class AIOrchestrator(AIProvider):
    """Elige el proveedor según la tarea y solo usa el respaldo en tareas compatibles.

    - primary: el proveedor principal, para todo.
    - fallback: el proveedor de respaldo (puede ser None).
    - grounded_provider: el proveedor que puede buscar en internet (puede ser None).
    """

    def __init__(
        self,
        primary: AIProvider,
        fallback: AIProvider | None = None,
        grounded_provider: AIProvider | None = None,
    ) -> None:
        """Guarda los proveedores. Si no se da uno para buscar, usa el principal si puede buscar."""
        self.primary = primary
        self.fallback = fallback
        self.grounded_provider = grounded_provider or (
            primary if primary.name in {AIProviderName.ENGINE, AIProviderName.FAKE} else None
        )
        # El orquestador se presenta con el nombre y modelo del principal.
        self.name = primary.name
        self.model = primary.model

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        """Pide datos estructurados al principal y, si falla con un error reintentable, al
        respaldo."""
        started = time.perf_counter()
        try:
            result = await self.primary.generate_structured(messages, schema)
        except AIProviderError as primary_error:
            # Se anota qué proveedor falló, para que la bitácora lo registre.
            primary_error.provider = self.primary.name
            primary_error.model = self.primary.model
            first_attempt = _failed_attempt(self.primary, primary_error, _elapsed_ms(started))
            # Sin respaldo, o si el error no conviene reintentar, el error sigue hacia arriba.
            if not primary_error.retryable or self.fallback is None:
                primary_error.attempts = (first_attempt,)
                raise
            fallback_started = time.perf_counter()
            try:
                result = await self.fallback.generate_structured(messages, schema)
            except AIProviderError as fallback_error:
                # Si también falla el respaldo, se guardan los dos intentos y se lanza el error.
                fallback_error.provider = self.fallback.name
                fallback_error.model = self.fallback.model
                fallback_error.attempts = (
                    first_attempt,
                    _failed_attempt(self.fallback, fallback_error, _elapsed_ms(fallback_started)),
                )
                raise
            # El respaldo respondió: el resultado lleva los dos intentos, el fallido y el exitoso.
            return replace(
                result,
                provider=self.fallback.name,
                model=self.fallback.model,
                attempts=(
                    first_attempt,
                    AIProviderAttempt(
                        provider=self.fallback.name,
                        model=self.fallback.model,
                        status="success",
                        latency_ms=_elapsed_ms(fallback_started),
                        usage=result.usage,
                    ),
                ),
            )
        # El principal respondió bien: un solo intento exitoso.
        return replace(
            result,
            provider=self.primary.name,
            model=self.primary.model,
            attempts=(
                AIProviderAttempt(
                    provider=self.primary.name,
                    model=self.primary.model,
                    status="success",
                    latency_ms=_elapsed_ms(started),
                    usage=result.usage,
                ),
            ),
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        """Pide una respuesta con búsqueda en internet. Solo cambia de proveedor si hay límite de
        uso."""
        provider = self.grounded_provider
        # Si no hay ningún proveedor que pueda buscar, se avisa en lugar de inventar fuentes.
        if provider is None:
            error = AIGroundingUnavailableError()
            error.provider = self.primary.name
            error.model = self.primary.model
            error.attempts = (_failed_attempt(provider=self.primary, error=error, latency_ms=0),)
            raise error

        started = time.perf_counter()
        try:
            result = await provider.generate_grounded(messages)
        except AIProviderError as error:
            error.provider = provider.name
            error.model = provider.model
            first_attempt = _failed_attempt(provider, error, _elapsed_ms(started))
            # El respaldo de búsqueda: el de respaldo general, o el principal si no es el mismo que
            # falló.
            fallback = self.fallback or (self.primary if self.primary is not provider else None)
            # Solo se cambia de proveedor por límite de uso. Otros errores se reportan tal cual.
            if not isinstance(error, AIRateLimitError) or fallback is None:
                error.attempts = (first_attempt,)
                raise
            fallback_started = time.perf_counter()
            try:
                result = await fallback.generate_grounded(messages)
            except AIProviderError as fallback_error:
                fallback_error.provider = fallback.name
                fallback_error.model = fallback.model
                fallback_error.attempts = (
                    first_attempt,
                    _failed_attempt(fallback, fallback_error, _elapsed_ms(fallback_started)),
                )
                raise
            return replace(
                result,
                provider=fallback.name,
                model=fallback.model,
                attempts=(
                    first_attempt,
                    AIProviderAttempt(
                        provider=fallback.name,
                        model=fallback.model,
                        status="success",
                        latency_ms=_elapsed_ms(fallback_started),
                        usage=result.usage,
                    ),
                ),
            )
        return replace(
            result,
            provider=provider.name,
            model=provider.model,
            attempts=(
                AIProviderAttempt(
                    provider=provider.name,
                    model=provider.model,
                    status="success",
                    latency_ms=_elapsed_ms(started),
                    usage=result.usage,
                ),
            ),
        )

    async def aclose(self) -> None:
        """Cierra cada proveedor una sola vez, aunque aparezca en varios papeles."""
        configured = (self.primary, self.fallback, self.grounded_provider)
        # Un diccionario con el id del objeto evita cerrar dos veces el mismo proveedor.
        providers = {id(provider): provider for provider in configured if provider is not None}
        for provider in providers.values():
            await provider.aclose()


def _failed_attempt(
    provider: AIProvider,
    error: AIProviderError,
    latency_ms: int,
) -> AIProviderAttempt:
    """Arma el registro de un intento fallido.

    El motor propio y el proveedor de prueba corren en local, así que su costo es cero.
    """
    return AIProviderAttempt(
        provider=provider.name,
        model=provider.model,
        status="error",
        latency_ms=latency_ms,
        usage=AIUsage(
            estimated_cost_usd=(
                Decimal(0)
                if provider.name in {AIProviderName.ENGINE, AIProviderName.FAKE}
                else None
            )
        ),
        error_code=error.code,
    )


def _elapsed_ms(started: float) -> int:
    """Milisegundos transcurridos desde un momento dado (de time.perf_counter)."""
    return round((time.perf_counter() - started) * 1000)
