"""Proveedor determinista para desarrollo y tests: no hace llamadas externas.

Todo lo que genera está marcado como SIMULADO y usa dominios reservados (example.*),
para que nunca se confunda con una investigación real.
"""

import asyncio
import hashlib
from collections.abc import Callable, Sequence

from pydantic import BaseModel

from app.core.enums import AIProviderName
from app.modules.ai.errors import AIInvalidResponseError
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.types import (
    AIMessage,
    AIUsage,
    CitationSpan,
    GroundedResult,
    GroundedSource,
    StructuredResult,
)

FAKE_MARKER = "[Simulado]"
FAKE_COMPETITOR = "Competidor Simulado"

type FakeResponder = Callable[[Sequence[AIMessage]], BaseModel]
_responders: dict[type[BaseModel], FakeResponder] = {}


def register_fake_response(schema: type[BaseModel]) -> Callable[[FakeResponder], FakeResponder]:
    """Cada módulo registra cómo simular la respuesta estructurada de sus esquemas."""

    def decorator(responder: FakeResponder) -> FakeResponder:
        _responders[schema] = responder
        return responder

    return decorator


def _usage(messages: Sequence[AIMessage], output: str, searches: int = 0) -> AIUsage:
    prompt_chars = sum(len(m.content) for m in messages)
    return AIUsage(
        input_tokens=prompt_chars // 4,
        output_tokens=len(output) // 4,
        search_queries_count=searches,
        estimated_cost_usd=None,
    )


class FakeProvider(AIProvider):
    name = AIProviderName.FAKE
    model = "fake-1"

    def __init__(self, latency_ms: int = 0) -> None:
        self.latency = latency_ms / 1000

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        await asyncio.sleep(self.latency)
        responder = _responders.get(schema)
        if responder is None:
            raise AIInvalidResponseError(f"Sin respuesta simulada para {schema.__name__}")
        data = schema.model_validate(responder(messages).model_dump())
        return StructuredResult(
            data=data,
            usage=_usage(messages, data.model_dump_json()),
            provider=self.name,
            model=self.model,
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        await asyncio.sleep(self.latency)
        question = messages[-1].content.split("\n", 1)[0][:160]
        slug = hashlib.sha1(question.encode()).hexdigest()[:8]
        parts: list[tuple[str, tuple[int, ...]]] = [
            (
                f"{FAKE_MARKER} Respuesta del proveedor de pruebas, sin búsqueda real. ",
                (),
            ),
            (f"Una fuente simulada describe el panorama relacionado con «{question}». ", (0,)),
            (
                f"Otra fuente simulada menciona a {FAKE_COMPETITOR} como alternativa existente. ",
                (1,),
            ),
            ("Interpretación: estos datos son ficticios y solo sirven para probar el flujo.", ()),
        ]
        text, citations = "", []
        for sentence, indexes in parts:
            start = len(text)
            text += sentence
            if indexes:
                citations.append(CitationSpan(start, len(text.rstrip()), indexes))
        sources = [
            # Común a todas las preguntas y con parámetro de rastreo: prueba la deduplicación.
            GroundedSource(
                "https://example.com/simulado/panorama?utm_source=ideaforge",
                "Fuente simulada: panorama general",
            ),
            GroundedSource(
                f"https://www.example.org/simulado/{slug}/", "Fuente simulada: alternativas"
            ),
            GroundedSource(f"https://example.net/simulado/{slug}", "Fuente simulada consultada"),
        ]
        return GroundedResult(
            text=text,
            sources=sources,
            citations=citations,
            executed_queries=[f"{question} (simulado)"],
            usage=_usage(messages, text, searches=1),
            provider=self.name,
            model=self.model,
        )
