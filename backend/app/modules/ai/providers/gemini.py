"""Proveedor de Gemini (Google): datos estructurados y respuestas con búsqueda en internet.

ARCHIVO: backend/app/modules/ai/providers/gemini.py

¿Qué es?
El adaptador que habla con la API de Gemini. Implementa las dos acciones del contrato AIProvider:
- generate_structured: pide un JSON que cumpla un esquema y lo valida.
- generate_grounded: pide una respuesta con búsqueda de Google activada, y devuelve las fuentes
  y las citas (qué parte de la respuesta viene de qué página).

¿Para qué sirve?
Es el proveedor principal en producción. Gemini es quien busca en internet y cita fuentes reales.

¿Quién lo usa?
factory.py lo crea cuando AI_PROVIDER=gemini (o cuando la búsqueda con Gemini está activa).
El orquestador lo llama a través de la interfaz AIProvider.

Caso especial: si Gemini responde 429 (límite de uso) en una búsqueda, este archivo no se rinde:
llama a web_search.py para buscar en fuentes públicas y redactar la respuesta a partir de ahí.

Cambios comunes:
- Modelo que se usa: GEMINI_MODEL en backend/.env.
- Búsqueda con Google activada o no: GEMINI_SEARCH_GROUNDING_ENABLED en backend/.env.
"""

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
    """Adaptador que habla con la API de Gemini de Google."""

    name = AIProviderName.GEMINI

    def __init__(
        self, api_key: str, model: str, timeout: float, search_grounding_enabled: bool = True
    ) -> None:
        """Guarda la clave, el modelo, el tiempo máximo de espera y si la búsqueda está activa."""
        # La clave se guarda con guion bajo: es privada y no debe usarse desde fuera de la clase.
        self._api_key = api_key
        self.model = model
        self.timeout = timeout
        self.search_grounding_enabled = search_grounding_enabled

    def _annotate(self, error: AIProviderError) -> AIProviderError:
        """Marca un error con el proveedor y el modelo que fallaron, para la bitácora."""
        error.provider = self.name
        error.model = self.model
        return error

    def _url(self) -> str:
        """Arma la dirección de la API para el modelo elegido."""
        # quote convierte caracteres raros del nombre del modelo en texto seguro para la dirección.
        model = quote(self.model, safe="")
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async def _generate(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Manda la petición a Gemini y devuelve la respuesta.

        Los errores llevan la marca del proveedor.
        """
        try:
            # La clave va en el encabezado "x-goog-api-key", no en la dirección.
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
        """Pide un JSON que cumpla el esquema y lo valida antes de devolverlo."""
        payload = _messages_payload(messages)
        try:
            # Convierte el esquema de Pydantic al formato que entiende Gemini.
            response_schema = _gemini_schema(schema.model_json_schema())
        except (KeyError, ValueError):
            raise self._annotate(AIInvalidResponseError()) from None
        # Le pedimos a Gemini que responda solo JSON con esa forma.
        payload["generationConfig"] = {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        }
        response = await self._generate(payload)
        try:
            text = _response_text(response)
            # Valida el texto contra el esquema. Si no cumple, se trata como respuesta inválida.
            data = schema.model_validate_json(text)
        except (AIProviderError, ValidationError, json.JSONDecodeError):
            raise self._annotate(AIInvalidResponseError()) from None
        # Los tokens vienen en "usageMetadata". Si no existe, se usa un diccionario vacío.
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
        """Pide una respuesta con búsqueda de Google y devuelve texto, fuentes y citas."""
        # Si la búsqueda está apagada en la configuración, se avisa de inmediato.
        if not self.search_grounding_enabled:
            raise self._annotate(AIGroundingUnavailableError())
        payload = _messages_payload(messages)
        # Activa la herramienta de búsqueda de Google para esta petición.
        payload["tools"] = [{"google_search": {}}]
        try:
            response = await self._generate(payload)
        except AIRateLimitError:
            # Límite de uso de Gemini: se busca con fuentes públicas en su lugar.
            return await synthesize_grounded_from_web(self, messages, self.timeout)
        try:
            text = _response_text(response)
        except AIProviderError:
            raise self._annotate(AIInvalidResponseError()) from None

        # La primera respuesta candidata trae los datos de búsqueda en "groundingMetadata".
        candidate = response["candidates"][0]
        grounding = candidate.get("groundingMetadata")
        if not isinstance(grounding, dict):
            grounding = {}
        chunks = grounding.get("groundingChunks")
        if not isinstance(chunks, list):
            chunks = []
        # Cada "chunk" es una página consultada.
        # Se guardan solo las que tienen una dirección http o https.
        sources: list[GroundedSource] = []
        # Relaciona el número que Gemini usa para cada página con la posición en nuestra lista.
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

        # "groundingSupports" dice qué parte del texto está respaldada por qué páginas.
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
            # El rango de letras (inicio y fin) debe existir dentro del texto.
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
            # Se traducen los números de Gemini a nuestras fuentes, descartando los que no existen.
            indexes = tuple(
                source_map[index]
                for index in chunk_indexes
                if isinstance(index, int) and index in source_map
            )
            if indexes:
                citations.append(CitationSpan(start, end, indexes))
                cited_sources.update(indexes)

        # Sin fuentes válidas o sin citas, no se puede garantizar que la respuesta esté respaldada.
        if not sources or not citations:
            raise self._annotate(AIGroundingUnavailableError())
        # Cada fuente se marca como citada solo si aparece en alguna cita.
        sources = [
            GroundedSource(source.url, source.title, index in cited_sources)
            for index, source in enumerate(sources)
        ]
        metadata = response.get("usageMetadata")
        if not isinstance(metadata, dict):
            metadata = {}
        # Las búsquedas que hizo Gemini, en texto.
        queries = grounding.get("webSearchQueries")
        if not isinstance(queries, list):
            queries = []
        # El bloque de sugerencias de búsqueda de Google. Gemini obliga a mostrarlo tal cual.
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
    """Convierte nuestros mensajes al formato de Gemini.

    Las instrucciones ("system") van aparte.
    Los mensajes de la IA ("assistant") se llaman "model" en Gemini.
    """
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
    """Saca el texto de la respuesta de Gemini.

    Si la respuesta viene vacía o mal formada, lanza error.
    """
    candidates = response.get("candidates")
    if not isinstance(candidates, list) or not candidates or not isinstance(candidates[0], dict):
        raise AIInvalidResponseError()
    content = candidates[0].get("content")
    if not isinstance(content, dict):
        raise AIInvalidResponseError()
    parts = content.get("parts")
    if not isinstance(parts, list):
        raise AIInvalidResponseError()
    # Une los pedazos de texto de todas las partes en un solo texto.
    text = "".join(
        part["text"]
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str)
    )
    if not text:
        raise AIInvalidResponseError()
    return text


def _token_count(value: Any) -> int | None:
    """Devuelve el número de tokens si es un entero válido (cero o más). Si no, None."""
    return value if isinstance(value, int) and value >= 0 else None


def _gemini_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Convierte un esquema de Pydantic (JSON Schema) al formato que acepta Gemini.

    Gemini no entiende todo JSON Schema: aquí se resuelven las referencias ($ref), se cambian
    los tipos a mayúsculas, y los campos que puedan ser vacíos se marcan como "nullable".
    Si aparece un tipo que no se puede convertir, lanza ValueError.
    """
    definitions = schema.get("$defs", {})

    def convert(node: dict[str, Any]) -> dict[str, Any]:
        """Convierte un nodo del esquema (y todo lo que contiene) al formato de Gemini."""
        # Una referencia ("$ref") apunta a una definición dentro de "$defs".
        # Se reemplaza por el contenido de esa definición.
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            return convert(definitions[ref.rsplit("/", 1)[-1]])
        # "anyOf" u "oneOf" significan "uno de estos tipos".
        # Solo se acepta si hay un tipo real y "null".
        choices = node.get("anyOf") or node.get("oneOf")
        if choices:
            non_null = [choice for choice in choices if choice.get("type") != "null"]
            if len(non_null) == 1:
                result = convert(non_null[0])
                # Si había un "null" entre las opciones, el campo puede venir vacío.
                result["nullable"] = len(non_null) != len(choices)
                return result
            raise ValueError("Gemini schema union no compatible")

        json_type = node.get("type")
        # Solo estos tipos existen en Gemini. Cualquier otro se rechaza.
        if json_type not in {"object", "array", "string", "integer", "number", "boolean"}:
            raise ValueError("Gemini schema type no compatible")
        # Gemini escribe los tipos en mayúsculas: "string" pasa a "STRING".
        result: dict[str, Any] = {"type": json_type.upper()}
        if isinstance(node.get("description"), str):
            result["description"] = node["description"]
        if isinstance(node.get("enum"), list):
            result["enum"] = node["enum"]
        if json_type == "object":
            # Convierte cada campo del objeto, y conserva la lista de campos obligatorios.
            result["properties"] = {
                key: convert(value) for key, value in (node.get("properties") or {}).items()
            }
            if node.get("required"):
                result["required"] = node["required"]
        if json_type == "array" and isinstance(node.get("items"), dict):
            # En una lista, "items" describe qué hay dentro de cada elemento.
            result["items"] = convert(node["items"])
        # Límites que Gemini sí entiende: mínimos y máximos de números, textos y listas.
        for key in ("minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"):
            if key in node:
                result[key] = node[key]
        return result

    return convert(schema)
