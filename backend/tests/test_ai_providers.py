import asyncio
import io
import json
from collections import Counter
from collections.abc import Sequence
from decimal import Decimal
from unittest.mock import patch
from urllib.error import HTTPError
from uuid import uuid4

import pytest
from pydantic import BaseModel, ValidationError

from app.core.enums import AIProviderName
from app.modules.ai.calls import AICallContext, AICallOutcome, build_call_logs
from app.modules.ai.errors import AIGroundingUnavailableError, AIRateLimitError
from app.modules.ai.factory import build_ai_provider
from app.modules.ai.models import AICallStatus, AIOperation
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.gemini import GeminiProvider
from app.modules.ai.providers.ollama import OllamaProvider
from app.modules.ai.providers.web_search import WebHit
from app.modules.ai.types import AIMessage, AIUsage, GroundedResult, StructuredResult
from app.modules.chat.schemas import ChatAnswer
from app.modules.research.orchestrator import _search_failure_code
from tests.conftest import make_settings


class Answer(BaseModel):
    text: str
    count: int


class StubResponse(io.BytesIO):
    pass


def response(body: dict) -> StubResponse:
    return StubResponse(json.dumps(body).encode())


def test_gemini_structured_output_keeps_key_off_url_and_validates_schema() -> None:
    requests = []

    def send(request, timeout):
        requests.append((request, timeout, json.loads(request.data)))
        return response(
            {
                "candidates": [{"content": {"parts": [{"text": '{"text":"listo","count":2}'}]}}],
                "usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 5},
            }
        )

    provider = GeminiProvider("test-secret", "gemini-test", 20)
    with patch("app.modules.ai.providers.http.urlopen", side_effect=send):
        result = asyncio.run(
            provider.generate_structured(
                [AIMessage("system", "Reglas"), AIMessage("user", "Entrada")], Answer
            )
        )

    request, timeout, payload = requests[0]
    assert "test-secret" not in request.full_url
    assert request.headers["X-goog-api-key"] == "test-secret"
    assert timeout == 20
    assert payload["systemInstruction"]["parts"][0]["text"] == "Reglas"
    assert payload["contents"][0]["role"] == "user"
    assert payload["generationConfig"]["responseSchema"]["type"] == "OBJECT"
    assert result.data == Answer(text="listo", count=2)
    assert result.usage.input_tokens == 12
    assert result.provider == AIProviderName.GEMINI


def test_gemini_grounding_maps_search_citations_and_suggestions() -> None:
    text = "Una señal del mercado."
    body = {
        "candidates": [
            {
                "content": {"parts": [{"text": text}]},
                "groundingMetadata": {
                    "webSearchQueries": ["demanda local"],
                    "groundingChunks": [
                        {"web": {"uri": "https://example.org/report", "title": "Informe"}}
                    ],
                    "groundingSupports": [
                        {
                            "segment": {"startIndex": 0, "endIndex": len(text)},
                            "groundingChunkIndices": [0],
                        }
                    ],
                    "searchEntryPoint": {"renderedContent": "<div>Search</div>"},
                },
            }
        ],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 9},
    }
    provider = GeminiProvider("key", "gemini-test", 20)
    with patch("app.modules.ai.providers.http.urlopen", return_value=response(body)):
        result = asyncio.run(provider.generate_grounded([AIMessage("user", "Investiga")]))

    assert result.text == text
    assert result.sources[0].url == "https://example.org/report"
    assert result.sources[0].cited is True
    assert result.citations[0].source_indexes == (0,)
    assert result.executed_queries == ["demanda local"]
    assert result.search_suggestions_html == "<div>Search</div>"
    assert result.usage.search_queries_count == 1


def test_gemini_grounding_falls_back_to_public_web_search_on_search_tool_429() -> None:
    calls: list[dict] = []

    def send(request, timeout):
        payload = json.loads(request.data)
        calls.append(payload)
        if "tools" in payload:
            raise HTTPError(request.full_url, 429, "quota", {}, io.BytesIO())
        return response(
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "statements": [
                                                {
                                                    "statement": (
                                                        "El mercado textil básico crece en México."
                                                    ),
                                                    "source_indexes": [0],
                                                }
                                            ]
                                        }
                                    )
                                }
                            ]
                        }
                    }
                ],
                "usageMetadata": {"promptTokenCount": 18, "candidatesTokenCount": 14},
            }
        )

    from app.modules.ai.providers.web_search import WebHit

    hits = [
        WebHit(
            url="https://inegi.org.mx/industria-textil",
            title="INEGI - Industria textil",
            snippet="La producción de prendas básicas registró crecimiento anual en México.",
        )
    ]
    provider = GeminiProvider("key", "gemini-test", 20)
    with (
        patch("app.modules.ai.providers.http.urlopen", side_effect=send),
        patch("app.modules.ai.providers.web_search.search_public_web", return_value=hits),
    ):
        result = asyncio.run(
            provider.generate_grounded([AIMessage("user", "¿Cómo va el mercado textil?")])
        )

    assert len(calls) == 2
    assert "tools" in calls[0]
    assert "generationConfig" in calls[1]
    assert "El mercado textil básico crece en México." in result.text
    assert result.sources[0].url == "https://inegi.org.mx/industria-textil"
    assert result.sources[0].cited is True
    assert result.citations[0].source_indexes == (0,)
    assert result.usage.search_queries_count == 1


def test_ollama_structured_output_records_local_zero_cost() -> None:
    seen = []

    def send(request, timeout):
        seen.append((request, json.loads(request.data)))
        return response(
            {
                "message": {"content": '{"text":"local","count":1}'},
                "prompt_eval_count": 20,
                "eval_count": 8,
            }
        )

    provider = OllamaProvider("http://localhost:11434", "custom-model", 20)
    with patch("app.modules.ai.providers.http.urlopen", side_effect=send):
        result = asyncio.run(provider.generate_structured([AIMessage("user", "Entrada")], Answer))

    request, payload = seen[0]
    assert request.full_url == "http://localhost:11434/api/chat"
    assert payload["model"] == "custom-model"
    assert payload["stream"] is False
    assert payload["think"] is False
    assert payload["options"]["num_predict"] == 1400
    assert isinstance(payload["format"], dict)
    assert result.data.text == "local"
    assert result.usage.input_tokens == 20
    assert result.usage.output_tokens == 8
    assert result.usage.estimated_cost_usd == Decimal(0)
    assert result.provider == AIProviderName.OLLAMA


def test_ollama_chat_answer_has_no_short_text_cap_and_a_larger_generation_budget() -> None:
    captured = []
    long_answer = "Respuesta completa. " * 300

    def send(request, timeout):
        payload = json.loads(request.data)
        captured.append(payload)
        return response(
            {
                "message": {
                    "content": json.dumps(
                        {"answer": long_answer, "finding_ids": []}, ensure_ascii=False
                    )
                },
                "prompt_eval_count": 100,
                "eval_count": 2000,
            }
        )

    provider = OllamaProvider("http://localhost:11434", "custom-model", 20)
    with patch("app.modules.ai.providers.http.urlopen", side_effect=send):
        result = asyncio.run(
            provider.generate_structured([AIMessage("user", "Desarrolla el análisis")], ChatAnswer)
        )

    assert result.data.answer == long_answer.strip()
    assert captured[0]["options"]["num_ctx"] == 8192
    assert captured[0]["options"]["num_predict"] == 4096
    assert captured[0]["options"]["repeat_penalty"] == 1.15
    assert captured[0]["options"]["temperature"] == 0.6
    assert "format" not in captured[0]
    assert "maxLength" not in ChatAnswer.model_json_schema()["properties"]["answer"]


def test_ollama_synthesizes_real_search_snippets_with_source_citations() -> None:
    hit = WebHit(
        url="https://example.org/ropa-basica",
        title="Estudio de ropa básica",
        snippet="La demanda de prendas lisas aumentó entre compradores jóvenes.",
    )

    def send(request, timeout):
        payload = json.loads(request.data)
        assert payload["model"] == "custom-model"
        assert "Estudio de ropa básica" in payload["messages"][1]["content"]
        return response(
            {
                "message": {
                    "content": json.dumps(
                        {
                            "statements": [
                                {
                                    "statement": "La demanda de prendas lisas aumentó.",
                                    "source_indexes": [0],
                                }
                            ]
                        }
                    )
                },
                "prompt_eval_count": 50,
                "eval_count": 18,
            }
        )

    provider = OllamaProvider("http://localhost:11434", "custom-model", 20)
    with (
        patch(
            "app.modules.ai.providers.web_search.search_public_web",
            return_value=[hit],
        ),
        patch("app.modules.ai.providers.http.urlopen", side_effect=send),
    ):
        actual = asyncio.run(provider.generate_grounded([AIMessage("user", "Busca actualidad")]))
    assert actual.provider == AIProviderName.OLLAMA
    assert actual.sources[0].url == hit.url
    assert actual.sources[0].cited is True
    assert actual.citations[0].source_indexes == (0,)
    assert actual.usage.input_tokens == 50
    assert actual.usage.output_tokens == 18


def test_orchestrator_falls_back_from_gemini_search_429_to_ollama_web_synthesis() -> None:
    class GroundedStub(StubProvider):
        def __init__(
            self,
            name: AIProviderName,
            model: str,
            *,
            error: Exception | None = None,
            result: GroundedResult | None = None,
        ) -> None:
            super().__init__(name, model, error)
            self.result = result

        async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
            if self.error:
                raise self.error
            assert self.result is not None
            return self.result

    grounded = GroundedResult(
        text="La oferta de ropa básica existe.",
        sources=[],
        citations=[],
        provider=AIProviderName.OLLAMA,
        model="qwen3:4b",
        usage=AIUsage(search_queries_count=1, estimated_cost_usd=Decimal(0)),
    )
    gemini = GroundedStub(AIProviderName.GEMINI, "gemini-test", error=AIRateLimitError())
    ollama = GroundedStub(AIProviderName.OLLAMA, "qwen3:4b", result=grounded)
    provider = AIOrchestrator(gemini, fallback=ollama)

    result = asyncio.run(provider.generate_grounded([AIMessage("user", "Busca actualidad")]))

    assert result.provider == AIProviderName.OLLAMA
    assert result.model == "qwen3:4b"
    assert [(attempt.provider, attempt.status) for attempt in result.attempts] == [
        (AIProviderName.GEMINI, "error"),
        (AIProviderName.OLLAMA, "success"),
    ]


def test_orchestrator_never_uses_local_fallback_for_grounded_search() -> None:
    provider = AIOrchestrator(StubProvider(AIProviderName.OLLAMA, "local-model"))
    with pytest.raises(AIGroundingUnavailableError):
        asyncio.run(provider.generate_grounded([AIMessage("user", "Busca actualidad")]))


def test_uniform_search_rate_limits_keep_the_provider_error_code() -> None:
    assert _search_failure_code(Counter({"ai_rate_limited": 6})) == "ai_rate_limited"
    assert (
        _search_failure_code(Counter({"ai_rate_limited": 3, "ai_timeout": 3}))
        == "all_searches_failed"
    )


def test_provider_http_429_is_classified_as_rate_limit() -> None:
    error = HTTPError("https://provider.example", 429, "limited", {}, io.BytesIO())
    with patch("app.modules.ai.providers.http.urlopen", side_effect=error):
        with pytest.raises(AIRateLimitError):
            asyncio.run(
                OllamaProvider("http://localhost:11434", "model", 20).generate_structured(
                    [AIMessage("user", "Entrada")], Answer
                )
            )


class StubProvider(AIProvider):
    def __init__(self, name: AIProviderName, model: str, error: Exception | None = None) -> None:
        self.name = name
        self.model = model
        self.error = error

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        if self.error:
            raise self.error
        return StructuredResult(
            data=schema.model_validate({"text": "local", "count": 1}),
            usage=AIUsage(input_tokens=4, output_tokens=3, estimated_cost_usd=Decimal(0)),
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        raise AIGroundingUnavailableError()


def test_orchestrator_fallback_logs_both_providers_and_only_then_uses_ollama() -> None:
    primary = StubProvider(AIProviderName.GEMINI, "gemini-test", AIRateLimitError())
    fallback = StubProvider(AIProviderName.OLLAMA, "local-test")
    provider = AIOrchestrator(primary, fallback)
    result = asyncio.run(provider.generate_structured([AIMessage("user", "Entrada")], Answer))
    logs = build_call_logs(
        AICallContext(uuid4(), uuid4()),
        provider,
        AIOperation.ANALYSIS,
        "test.v1",
        AICallOutcome(result, None, 1),
        result.usage,
    )

    assert [log.provider for log in logs] == [AIProviderName.GEMINI, AIProviderName.OLLAMA]
    assert [log.status for log in logs] == [AICallStatus.ERROR, AICallStatus.SUCCESS]
    assert logs[0].error_code == "ai_rate_limited"
    assert logs[1].estimated_cost_usd == Decimal(0)


@pytest.mark.parametrize(
    "base_url",
    ["http://user:secret@localhost:11434", "http://localhost:not-a-port"],
)
def test_ollama_url_rejects_credentials_and_invalid_ports(base_url: str) -> None:
    with pytest.raises(ValidationError):
        make_settings(ai_provider="ollama", ollama_base_url=base_url)


def test_settings_select_gemini_or_ollama_and_require_gemini_key() -> None:
    with pytest.raises(ValidationError):
        make_settings(ai_provider="gemini")

    gemini = build_ai_provider(make_settings(ai_provider="gemini", gemini_api_key="test-key"))
    ollama_settings = make_settings(
        ai_provider="ollama", ollama_model="my-local-model", gemini_api_key=""
    )
    ollama = build_ai_provider(ollama_settings)

    assert ollama_settings.gemini_api_key is None
    assert isinstance(gemini, AIOrchestrator)
    assert gemini.name == AIProviderName.GEMINI
    assert isinstance(ollama, AIOrchestrator)
    assert ollama.name == AIProviderName.OLLAMA
    assert ollama.model == "my-local-model"
