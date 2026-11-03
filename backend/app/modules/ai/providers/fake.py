# ARCHIVO: backend/app/modules/ai/providers/fake.py
#
# ¿Qué es?
# Un proveedor de IA falso, para desarrollo y pruebas. No llama a ningún servicio externo.
# Responde con datos fijos que siempre llevan la marca [Simulado] y usan dominios de ejemplo
# (example.com, example.org), para que nadie los confunda con una investigación real.
#
# ¿Para qué sirve?
# - Probar la aplicación sin gastar en IA ni depender de internet.
# - Las pruebas automáticas (217) usan este proveedor para que siempre den el mismo resultado.
# - Está PROHIBIDO en producción: config.py lo rechaza si APP_ENV=production.
#
# ¿Quién lo usa?
# factory.py (cuando AI_PROVIDER=fake) y las pruebas.
#
# Cambios comunes:
# - Cuánto tarda la respuesta simulada: AI_FAKE_LATENCY_MS en backend/.env.
# - Qué responde para un esquema: lo registra cada módulo con @register_fake_response.

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

# Texto que aparece al principio de toda respuesta simulada, para que quede claro que es falsa.
FAKE_MARKER = "[Simulado]"
# Nombre de competidor inventado que usan las respuestas simuladas.
FAKE_COMPETITOR = "Competidor Simulado"

# Tipo de función que genera una respuesta simulada para un esquema.
type FakeResponder = Callable[[Sequence[AIMessage]], BaseModel]
# Diccionario: esquema -> función que lo responde. Cada módulo lo llena con su decorador.
_responders: dict[type[BaseModel], FakeResponder] = {}


def register_fake_response(schema: type[BaseModel]) -> Callable[[FakeResponder], FakeResponder]:
    """Decorador: registra la función que simula la respuesta de un esquema.

    Uso: @register_fake_response(MiEsquema) encima de la función que devuelve un MiEsquema falso.
    """

    def decorator(responder: FakeResponder) -> FakeResponder:
        """Guarda la función en el diccionario y la devuelve sin cambios."""
        _responders[schema] = responder
        return responder

    return decorator


def _usage(messages: Sequence[AIMessage], output: str, searches: int = 0) -> AIUsage:
    """Calcula tokens aproximados: un token equivale a unos 4 caracteres."""
    prompt_chars = sum(len(m.content) for m in messages)
    return AIUsage(
        input_tokens=prompt_chars // 4,
        output_tokens=len(output) // 4,
        search_queries_count=searches,
        # El proveedor de prueba no tiene costo real, así que se deja sin valor.
        estimated_cost_usd=None,
    )


class FakeProvider(AIProvider):
    """Proveedor de pruebas que responde con datos fijos."""

    name = AIProviderName.FAKE
    model = "fake-1"

    def __init__(self, latency_ms: int = 0) -> None:
        """Guarda la pausa simulada, convertida de milisegundos a segundos."""
        self.latency = latency_ms / 1000

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        """Devuelve la respuesta simulada registrada para el esquema, tras la pausa simulada."""
        # Pausa para simular el tiempo de una IA real.
        await asyncio.sleep(self.latency)
        responder = _responders.get(schema)
        # Si ningún módulo registró una respuesta para este esquema, es un error de preparación.
        if responder is None:
            raise AIInvalidResponseError(f"Sin respuesta simulada para {schema.__name__}")
        # Se valida la respuesta simulada contra el esquema, igual que lo haría con una real.
        data = schema.model_validate(responder(messages).model_dump())
        return StructuredResult(
            data=data,
            usage=_usage(messages, data.model_dump_json()),
            provider=self.name,
            model=self.model,
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        """Devuelve un texto simulado con tres fuentes falsas y sus citas."""
        await asyncio.sleep(self.latency)
        # La pregunta es la primera línea del último mensaje, recortada a 160 letras.
        question = messages[-1].content.split("\n", 1)[0][:160]
        # Un código corto derivado de la pregunta: las mismas preguntas dan las mismas fuentes.
        slug = hashlib.sha1(question.encode()).hexdigest()[:8]
        # Cada parte es (texto, fuentes que la respaldan). Sin fuentes = no se cita.
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
        # Se arma el texto completo y se calcula en qué posición queda cada parte citada.
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
