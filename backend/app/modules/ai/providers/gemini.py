"""Utilidad de soporte. Area: proveedores de IA."""

import json
from collections.abc import Sequence
from typing import Any
from urllib.parse import quote

from pydantic import BaseModel, ValidationError

from app.core.enums import AIProviderName
from app.modules.ai.errors import (
    AIGroundingUnavailableError,
    AIInvalidResponseError,
    AIProviderError,
    AIRateLimitError,
)
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.http import post_json
from app.modules.ai.providers.web_search import synthesize_grounded_from_web
from app.modules.ai.types import (
    AIMessage,
    AIUsage,
    CitationSpan,
    GroundedResult,
    GroundedSource,
    StructuredResult,
)


class GeminiProvider(AIProvider):
    """Adaptador que ofrece servicios de gemini."""

    name = AIProviderName.GEMINI

    def __init__(
        self, api_key: str, model: str, timeout: float, search_grounding_enabled: bool = True
    ) -> None:
        """Gestiona la inicializacion para inteligencia artificial."""
        self._api_key = api_key
        self.model = model
        self.timeout = timeout
        self.search_grounding_enabled = search_grounding_enabled

    def _annotate(self, error: AIProviderError) -> AIProviderError:
        """Gestiona annotate."""
        error.provider = self.name
        error.model = self.model
        return error

    def _url(self) -> str:
        """Gestiona URL."""
        model = quote(self.model, safe="")
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async def _generate(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Gestiona generate."""
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            return await post_json(
                self._url(),
                payload,
                {"x-goog-api-key": self._api_key},
                self.timeout,
            )
        # Maneja el error AIProviderError sin detener el flujo esperado.
        except AIProviderError as exc:
            raise self._annotate(exc) from None

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        """Gestiona generate structured."""
        payload = _messages_payload(messages)
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            response_schema = _gemini_schema(schema.model_json_schema())
        # Maneja el error (KeyError, ValueError) sin detener el flujo esperado.
        except (KeyError, ValueError):
            raise self._annotate(AIInvalidResponseError()) from None
        payload["generationConfig"] = {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        }
        response = await self._generate(payload)
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            text = _response_text(response)
            data = schema.model_validate_json(text)
        # Maneja el error (AIProviderError, ValidationError, json.JSONDecodeError) sin detener el
        # flujo esperado.
        except (AIProviderError, ValidationError, json.JSONDecodeError):
            raise self._annotate(AIInvalidResponseError()) from None
        metadata = response.get("usageMetadata")
        # Rama condicional: se cumple not isinstance(metadata, dict).
        if not isinstance(metadata, dict):
            metadata = {}
        return StructuredResult(
            data=data,
            usage=AIUsage(
                input_tokens=_token_count(metadata.get("promptTokenCount")),
                output_tokens=_token_count(metadata.get("candidatesTokenCount")),
            ),
            provider=self.name,
            model=self.model,
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        """Gestiona generate fundamentada."""
        # Rama condicional: se cumple not self.search_grounding_enabled.
        if not self.search_grounding_enabled:
            raise self._annotate(AIGroundingUnavailableError())
        payload = _messages_payload(messages)
        payload["tools"] = [{"google_search": {}}]
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            response = await self._generate(payload)
        # Maneja el error AIRateLimitError sin detener el flujo esperado.
        except AIRateLimitError:
            return await synthesize_grounded_from_web(self, messages, self.timeout)
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            text = _response_text(response)
        # Maneja el error AIProviderError sin detener el flujo esperado.
        except AIProviderError:
            raise self._annotate(AIInvalidResponseError()) from None

        candidate = response["candidates"][0]
        grounding = candidate.get("groundingMetadata")
        # Rama condicional: se cumple not isinstance(grounding, dict).
        if not isinstance(grounding, dict):
            grounding = {}
        chunks = grounding.get("groundingChunks")
        # Rama condicional: se cumple not isinstance(chunks, list).
        if not isinstance(chunks, list):
            chunks = []
        sources: list[GroundedSource] = []
        source_map: dict[int, int] = {}
        # Itera (index, chunk) sobre enumerate(chunks).
        for index, chunk in enumerate(chunks):
            # Rama condicional: se cumple not isinstance(chunk, dict).
            if not isinstance(chunk, dict):
                continue
            web = chunk.get("web")
            # Rama condicional: se cumple not isinstance(web, dict).
            if not isinstance(web, dict):
                continue
            url = web.get("uri")
            # Rama condicional: evalua isinstance(url, str) and url.startswith((un valor, un
            # valor)).
            if isinstance(url, str) and url.startswith(("https://", "http://")):
                source_map[index] = len(sources)
                title = web.get("title")
                sources.append(
                    GroundedSource(url=url, title=title if isinstance(title, str) else None)
                )

        supports = grounding.get("groundingSupports")
        # Rama condicional: se cumple not isinstance(supports, list).
        if not isinstance(supports, list):
            supports = []
        citations: list[CitationSpan] = []
        cited_sources: set[int] = set()
        # Itera support sobre supports.
        for support in supports:
            # Rama condicional: se cumple not isinstance(support, dict).
            if not isinstance(support, dict):
                continue
            segment = support.get("segment")
            # Rama condicional: se cumple not isinstance(segment, dict).
            if not isinstance(segment, dict):
                continue
            start, end = segment.get("startIndex"), segment.get("endIndex")
            # Rama condicional: evalua not isinstance(start, int) or not isinstance(end, int) or
            # (not 0 <= star.
            if (
                not isinstance(start, int)
                or not isinstance(end, int)
                or not 0 <= start < end <= len(text)
            ):
                continue
            chunk_indexes = support.get("groundingChunkIndices")
            # Rama condicional: se cumple not isinstance(chunk_indexes, list).
            if not isinstance(chunk_indexes, list):
                continue
            indexes = tuple(
                source_map[index]
                for index in chunk_indexes
                if isinstance(index, int) and index in source_map
            )
            # Rama condicional: se cumple indexes.
            if indexes:
                citations.append(CitationSpan(start, end, indexes))
                cited_sources.update(indexes)

        # Rama condicional: se cumple not sources or not citations.
        if not sources or not citations:
            raise self._annotate(AIGroundingUnavailableError())
        sources = [
            GroundedSource(source.url, source.title, index in cited_sources)
            for index, source in enumerate(sources)
        ]
        metadata = response.get("usageMetadata")
        # Rama condicional: se cumple not isinstance(metadata, dict).
        if not isinstance(metadata, dict):
            metadata = {}
        queries = grounding.get("webSearchQueries")
        # Rama condicional: se cumple not isinstance(queries, list).
        if not isinstance(queries, list):
            queries = []
        entry_point = grounding.get("searchEntryPoint")
        # Rama condicional: se cumple not isinstance(entry_point, dict).
        if not isinstance(entry_point, dict):
            entry_point = {}
        suggestions = entry_point.get("renderedContent")
        # Rama condicional: se cumple not isinstance(suggestions, str).
        if not isinstance(suggestions, str):
            suggestions = None
        return GroundedResult(
            text=text,
            sources=sources,
            citations=citations,
            executed_queries=[query for query in queries if isinstance(query, str)],
            search_suggestions_html=suggestions,
            usage=AIUsage(
                input_tokens=_token_count(metadata.get("promptTokenCount")),
                output_tokens=_token_count(metadata.get("candidatesTokenCount")),
                search_queries_count=len(queries),
            ),
            provider=self.name,
            model=self.model,
        )


def _messages_payload(messages: Sequence[AIMessage]) -> dict[str, Any]:
    """Gestiona messages payload."""
    system = "\n\n".join(message.content for message in messages if message.role == "system")
    contents = [
        {
            "role": "model" if message.role == "assistant" else "user",
            "parts": [{"text": message.content}],
        }
        for message in messages
        if message.role != "system"
    ]
    payload: dict[str, Any] = {"contents": contents}
    # Rama condicional: se cumple system.
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    return payload


def _response_text(response: dict[str, Any]) -> str:
    """Gestiona respuesta texto."""
    candidates = response.get("candidates")
    # Rama condicional: evalua not isinstance(candidates, list) or not candidates or (not
    # isinstance(ca.
    if not isinstance(candidates, list) or not candidates or not isinstance(candidates[0], dict):
        raise AIInvalidResponseError()
    content = candidates[0].get("content")
    # Rama condicional: se cumple not isinstance(content, dict).
    if not isinstance(content, dict):
        raise AIInvalidResponseError()
    parts = content.get("parts")
    # Rama condicional: se cumple not isinstance(parts, list).
    if not isinstance(parts, list):
        raise AIInvalidResponseError()
    text = "".join(
        part["text"]
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str)
    )
    # Rama condicional: se cumple not text.
    if not text:
        raise AIInvalidResponseError()
    return text


def _token_count(value: Any) -> int | None:
    """Gestiona token cantidad."""
    return value if isinstance(value, int) and value >= 0 else None


def _gemini_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Gestiona gemini esquema."""
    definitions = schema.get("$defs", {})

    def convert(node: dict[str, Any]) -> dict[str, Any]:
        """Gestiona convert."""
        ref = node.get("$ref")
        # Rama condicional: se cumple isinstance(ref, str) and ref.startswith('#/$defs/').
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            return convert(definitions[ref.rsplit("/", 1)[-1]])
        choices = node.get("anyOf") or node.get("oneOf")
        # Rama condicional: se cumple choices.
        if choices:
            non_null = [choice for choice in choices if choice.get("type") != "null"]
            # Rama condicional: se cumple len(non_null) == 1.
            if len(non_null) == 1:
                result = convert(non_null[0])
                result["nullable"] = len(non_null) != len(choices)
                return result
            raise ValueError("Gemini schema union no compatible")

        json_type = node.get("type")
        # Rama condicional: evalua json_type not in {un valor, un valor, un valor, un valor, un
        # valor, un v.
        if json_type not in {"object", "array", "string", "integer", "number", "boolean"}:
            raise ValueError("Gemini schema type no compatible")
        result: dict[str, Any] = {"type": json_type.upper()}
        # Rama condicional: se cumple isinstance(node.get('description'), str).
        if isinstance(node.get("description"), str):
            result["description"] = node["description"]
        # Rama condicional: se cumple isinstance(node.get('enum'), list).
        if isinstance(node.get("enum"), list):
            result["enum"] = node["enum"]
        # Rama condicional: se cumple json_type == 'object'.
        if json_type == "object":
            result["properties"] = {
                key: convert(value) for key, value in (node.get("properties") or {}).items()
            }
            # Rama condicional: se cumple node.get('required').
            if node.get("required"):
                result["required"] = node["required"]
        # Rama condicional: se cumple json_type == 'array' and isinstance(node.get('items'),
        # dict).
        if json_type == "array" and isinstance(node.get("items"), dict):
            result["items"] = convert(node["items"])
        # Itera key sobre (un valor, un valor, un valor, un valor, un valor, un valor).
        for key in ("minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"):
            # Rama condicional: se cumple key in node.
            if key in node:
                result[key] = node[key]
        return result

    return convert(schema)
