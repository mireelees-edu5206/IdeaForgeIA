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
    name = AIProviderName.GEMINI

    def __init__(
        self, api_key: str, model: str, timeout: float, search_grounding_enabled: bool = True
    ) -> None:
        self._api_key = api_key
        self.model = model
        self.timeout = timeout
        self.search_grounding_enabled = search_grounding_enabled

    def _annotate(self, error: AIProviderError) -> AIProviderError:
        error.provider = self.name
        error.model = self.model
        return error

    def _url(self) -> str:
        model = quote(self.model, safe="")
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async def _generate(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return await post_json(
                self._url(),
                payload,
                {"x-goog-api-key": self._api_key},
                self.timeout,
            )
        except AIProviderError as exc:
            raise self._annotate(exc) from None

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        payload = _messages_payload(messages)
        try:
            response_schema = _gemini_schema(schema.model_json_schema())
        except (KeyError, ValueError):
            raise self._annotate(AIInvalidResponseError()) from None
        payload["generationConfig"] = {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        }
        response = await self._generate(payload)
        try:
            text = _response_text(response)
            data = schema.model_validate_json(text)
        except (AIProviderError, ValidationError, json.JSONDecodeError):
            raise self._annotate(AIInvalidResponseError()) from None
        metadata = response.get("usageMetadata")
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
        if not self.search_grounding_enabled:
            raise self._annotate(AIGroundingUnavailableError())
        payload = _messages_payload(messages)
        payload["tools"] = [{"google_search": {}}]
        try:
            response = await self._generate(payload)
        except AIRateLimitError:
            return await synthesize_grounded_from_web(self, messages, self.timeout)
        try:
            text = _response_text(response)
        except AIProviderError:
            raise self._annotate(AIInvalidResponseError()) from None

        candidate = response["candidates"][0]
        grounding = candidate.get("groundingMetadata")
        if not isinstance(grounding, dict):
            grounding = {}
        chunks = grounding.get("groundingChunks")
        if not isinstance(chunks, list):
            chunks = []
        sources: list[GroundedSource] = []
        source_map: dict[int, int] = {}
        for index, chunk in enumerate(chunks):
            if not isinstance(chunk, dict):
                continue
            web = chunk.get("web")
            if not isinstance(web, dict):
                continue
            url = web.get("uri")
            if isinstance(url, str) and url.startswith(("https://", "http://")):
                source_map[index] = len(sources)
                title = web.get("title")
                sources.append(
                    GroundedSource(url=url, title=title if isinstance(title, str) else None)
                )

        supports = grounding.get("groundingSupports")
        if not isinstance(supports, list):
            supports = []
        citations: list[CitationSpan] = []
        cited_sources: set[int] = set()
        for support in supports:
            if not isinstance(support, dict):
                continue
            segment = support.get("segment")
            if not isinstance(segment, dict):
                continue
            start, end = segment.get("startIndex"), segment.get("endIndex")
            if (
                not isinstance(start, int)
                or not isinstance(end, int)
                or not 0 <= start < end <= len(text)
            ):
                continue
            chunk_indexes = support.get("groundingChunkIndices")
            if not isinstance(chunk_indexes, list):
                continue
            indexes = tuple(
                source_map[index]
                for index in chunk_indexes
                if isinstance(index, int) and index in source_map
            )
            if indexes:
                citations.append(CitationSpan(start, end, indexes))
                cited_sources.update(indexes)

        if not sources or not citations:
            raise self._annotate(AIGroundingUnavailableError())
        sources = [
            GroundedSource(source.url, source.title, index in cited_sources)
            for index, source in enumerate(sources)
        ]
        metadata = response.get("usageMetadata")
        if not isinstance(metadata, dict):
            metadata = {}
        queries = grounding.get("webSearchQueries")
        if not isinstance(queries, list):
            queries = []
        entry_point = grounding.get("searchEntryPoint")
        if not isinstance(entry_point, dict):
            entry_point = {}
        suggestions = entry_point.get("renderedContent")
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
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    return payload


def _response_text(response: dict[str, Any]) -> str:
    candidates = response.get("candidates")
    if not isinstance(candidates, list) or not candidates or not isinstance(candidates[0], dict):
        raise AIInvalidResponseError()
    content = candidates[0].get("content")
    if not isinstance(content, dict):
        raise AIInvalidResponseError()
    parts = content.get("parts")
    if not isinstance(parts, list):
        raise AIInvalidResponseError()
    text = "".join(
        part["text"]
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str)
    )
    if not text:
        raise AIInvalidResponseError()
    return text


def _token_count(value: Any) -> int | None:
    return value if isinstance(value, int) and value >= 0 else None


def _gemini_schema(schema: dict[str, Any]) -> dict[str, Any]:
    definitions = schema.get("$defs", {})

    def convert(node: dict[str, Any]) -> dict[str, Any]:
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            return convert(definitions[ref.rsplit("/", 1)[-1]])
        choices = node.get("anyOf") or node.get("oneOf")
        if choices:
            non_null = [choice for choice in choices if choice.get("type") != "null"]
            if len(non_null) == 1:
                result = convert(non_null[0])
                result["nullable"] = len(non_null) != len(choices)
                return result
            raise ValueError("Gemini schema union no compatible")

        json_type = node.get("type")
        if json_type not in {"object", "array", "string", "integer", "number", "boolean"}:
            raise ValueError("Gemini schema type no compatible")
        result: dict[str, Any] = {"type": json_type.upper()}
        if isinstance(node.get("description"), str):
            result["description"] = node["description"]
        if isinstance(node.get("enum"), list):
            result["enum"] = node["enum"]
        if json_type == "object":
            result["properties"] = {
                key: convert(value) for key, value in (node.get("properties") or {}).items()
            }
            if node.get("required"):
                result["required"] = node["required"]
        if json_type == "array" and isinstance(node.get("items"), dict):
            result["items"] = convert(node["items"])
        for key in ("minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"):
            if key in node:
                result[key] = node[key]
        return result

    return convert(schema)
