import json
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ValidationError

from app.core.enums import AIProviderName
from app.modules.ai.errors import (
    AIInvalidResponseError,
    AIProviderError,
)
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.http import post_json
from app.modules.ai.providers.web_search import synthesize_grounded_from_web
from app.modules.ai.types import AIMessage, AIUsage, GroundedResult, StructuredResult


class OllamaProvider(AIProvider):
    name = AIProviderName.OLLAMA

    def __init__(self, base_url: str, model: str, timeout: float, think: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.think = think

    def _annotate(self, error: AIProviderError) -> AIProviderError:
        error.provider = self.name
        error.model = self.model
        return error

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        is_chat_answer = schema.__name__ == "ChatAnswer"
        is_report_draft = schema.__name__ == "ReportDraft"
        payload = {
            "model": self.model,
            "messages": [
                {"role": message.role, "content": message.content} for message in messages
            ],
            "stream": False,
            "think": self.think,
            "keep_alive": "30m",
            "options": {
                "temperature": 0.6 if is_chat_answer else 0.2,
                "num_ctx": 8192 if is_chat_answer else 16384 if is_report_draft else 4096,
                "num_predict": 4096 if is_chat_answer or is_report_draft else 1400,
                "repeat_penalty": 1.15 if is_chat_answer else 1.05 if is_report_draft else 1.0,
                "top_p": 0.9 if is_chat_answer or is_report_draft else 1.0,
            },
            "format": schema.model_json_schema(),
        }
        try:
            response = await post_json(f"{self.base_url}/api/chat", payload, {}, self.timeout)
            message = response.get("message")
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str):
                raise AIInvalidResponseError()
            data = schema.model_validate_json(content)
        except (AIProviderError, ValidationError, json.JSONDecodeError) as exc:
            if isinstance(exc, AIProviderError):
                raise self._annotate(exc) from None
            raise self._annotate(AIInvalidResponseError()) from None

        return StructuredResult(
            data=data,
            usage=AIUsage(
                input_tokens=_token_count(response.get("prompt_eval_count")),
                output_tokens=_token_count(response.get("eval_count")),
                estimated_cost_usd=Decimal(0),
            ),
            provider=self.name,
            model=self.model,
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        try:
            return await synthesize_grounded_from_web(self, messages, self.timeout)
        except AIProviderError as exc:
            raise self._annotate(exc) from None


def _token_count(value: Any) -> int | None:
    return value if isinstance(value, int) and value >= 0 else None
