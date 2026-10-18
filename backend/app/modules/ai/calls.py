"""Ejecución medida de llamadas a la IA y su registro en ai_api_logs."""

import asyncio
import time
import uuid
from collections.abc import Awaitable
from dataclasses import dataclass

from app.modules.ai.errors import AIProviderError, AITimeoutError
from app.modules.ai.models import AIApiLog, AICallStatus, AIOperation
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.types import AIProviderAttempt, AIUsage


@dataclass(frozen=True, slots=True)
class AICallContext:
    user_id: uuid.UUID
    project_id: uuid.UUID
    research_run_id: uuid.UUID | None = None


@dataclass(frozen=True, slots=True)
class AICallOutcome[T]:
    result: T | None
    error: AIProviderError | None
    latency_ms: int


async def timed_call[T](call: Awaitable[T], timeout_s: float) -> AICallOutcome[T]:
    """Ejecuta la llamada con límite de tiempo. Solo captura errores del proveedor."""
    started = time.perf_counter()

    def elapsed() -> int:
        return round((time.perf_counter() - started) * 1000)

    try:
        async with asyncio.timeout(timeout_s):
            result = await call
    except TimeoutError:
        return AICallOutcome(None, AITimeoutError(), elapsed())
    except AIProviderError as exc:
        return AICallOutcome(None, exc, elapsed())
    return AICallOutcome(result, None, elapsed())


def build_call_logs(
    ctx: AICallContext,
    provider: AIProvider,
    operation: AIOperation,
    prompt_version: str,
    outcome: AICallOutcome[object],
    usage: AIUsage | None,
) -> list[AIApiLog]:
    """Registra cada proveedor intentado, nunca prompts, respuestas ni claves."""
    result = outcome.result
    attempts = getattr(result, "attempts", ()) if result is not None else ()
    if outcome.error is not None:
        attempts = outcome.error.attempts
    if not attempts:
        actual_provider = (
            getattr(result, "provider", None)
            or getattr(outcome.error, "provider", None)
            or provider.name
        )
        actual_model = (
            getattr(result, "model", None)
            or getattr(outcome.error, "model", None)
            or provider.model
        )
        attempts = (
            AIProviderAttempt(
                provider=actual_provider,
                model=actual_model,
                status="error" if outcome.error else "success",
                latency_ms=outcome.latency_ms,
                usage=usage or AIUsage(),
                error_code=outcome.error.code if outcome.error else None,
            ),
        )
    return [
        AIApiLog(
            user_id=ctx.user_id,
            project_id=ctx.project_id,
            research_run_id=ctx.research_run_id,
            provider=attempt.provider,
            model=attempt.model,
            operation=operation,
            prompt_version=prompt_version,
            status=AICallStatus.ERROR if attempt.status == "error" else AICallStatus.SUCCESS,
            error_code=attempt.error_code,
            input_tokens=attempt.usage.input_tokens,
            output_tokens=attempt.usage.output_tokens,
            search_queries_count=attempt.usage.search_queries_count,
            latency_ms=attempt.latency_ms,
            estimated_cost_usd=attempt.usage.estimated_cost_usd,
        )
        for attempt in attempts
    ]
