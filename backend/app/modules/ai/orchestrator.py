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
    """Selecciona proveedor por capacidad y limita el fallback a tareas compatibles."""

    def __init__(
        self,
        primary: AIProvider,
        fallback: AIProvider | None = None,
        grounded_provider: AIProvider | None = None,
    ) -> None:
        self.primary = primary
        self.fallback = fallback
        self.grounded_provider = grounded_provider or (
            primary if primary.name in {AIProviderName.GEMINI, AIProviderName.FAKE} else None
        )
        self.name = primary.name
        self.model = primary.model

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        started = time.perf_counter()
        try:
            result = await self.primary.generate_structured(messages, schema)
        except AIProviderError as primary_error:
            primary_error.provider = self.primary.name
            primary_error.model = self.primary.model
            first_attempt = _failed_attempt(self.primary, primary_error, _elapsed_ms(started))
            if not primary_error.retryable or self.fallback is None:
                primary_error.attempts = (first_attempt,)
                raise
            fallback_started = time.perf_counter()
            try:
                result = await self.fallback.generate_structured(messages, schema)
            except AIProviderError as fallback_error:
                fallback_error.provider = self.fallback.name
                fallback_error.model = self.fallback.model
                fallback_error.attempts = (
                    first_attempt,
                    _failed_attempt(self.fallback, fallback_error, _elapsed_ms(fallback_started)),
                )
                raise
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
        provider = self.grounded_provider
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
            fallback = self.fallback or (self.primary if self.primary is not provider else None)
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
        configured = (self.primary, self.fallback, self.grounded_provider)
        providers = {id(provider): provider for provider in configured if provider is not None}
        for provider in providers.values():
            await provider.aclose()


def _failed_attempt(
    provider: AIProvider,
    error: AIProviderError,
    latency_ms: int,
) -> AIProviderAttempt:
    return AIProviderAttempt(
        provider=provider.name,
        model=provider.model,
        status="error",
        latency_ms=latency_ms,
        usage=AIUsage(
            estimated_cost_usd=(
                Decimal(0)
                if provider.name in {AIProviderName.OLLAMA, AIProviderName.FAKE}
                else None
            )
        ),
        error_code=error.code,
    )


def _elapsed_ms(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)
