import re
import unicodedata
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError
from app.modules.ai.calls import AICallContext, build_call_logs, timed_call
from app.modules.ai.errors import AIProviderError
from app.modules.ai.models import AIOperation
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.types import AIMessage
from app.modules.chat import fake_responses as _fake_responses  # noqa: F401
from app.modules.chat.context import build_project_context
from app.modules.chat.prompts import CHAT_PROMPT_VERSION, build_chat_messages
from app.modules.chat.schemas import ChatAnswer, ChatRequest, ChatResponse
from app.modules.projects.service import get_owned_project
from app.modules.users.models import User

_CHAT_ERROR_MESSAGES = {
    "ai_timeout": "El asistente tardó demasiado en responder. Inténtalo de nuevo.",
    "ai_rate_limited": "Se alcanzó temporalmente el límite de uso de IA. Inténtalo más tarde.",
    "ai_authentication": "La autenticación del asistente no está configurada correctamente.",
    "ai_unavailable": "El asistente no está disponible en este momento.",
    "ai_invalid_response": "El asistente generó una respuesta con un formato inesperado.",
    "ai_error": "El asistente no pudo responder en este momento.",
}


_GREETINGS = {
    "buenas",
    "buenas noches",
    "buenas tardes",
    "buenos dias",
    "como andas",
    "como estas",
    "como te va",
    "hello",
    "hey",
    "hola",
    "hola como estas",
    "hola que tal",
    "que tal",
}


def _greeting_reply(message: str, project_title: str, has_history: bool) -> ChatResponse | None:
    normalized = unicodedata.normalize("NFD", message.casefold())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = " ".join(re.sub(r"[^\w\s]", " ", normalized).split())
    if normalized not in _GREETINGS:
        return None
    greeting = "Estoy listo" if has_history else "¡Hola! Estoy listo"
    return ChatResponse(
        answer=(
            f"{greeting} para ayudarte con {project_title}. ¿Qué te gustaría revisar del proyecto?"
        ),
        references=[],
    )


def _is_question_echo(user_message: str, answer: str) -> bool:
    stripped = answer.strip()
    if len(stripped) < 120 and stripped.startswith("¿") and stripped.endswith("?"):
        return True
    if len(stripped) < 95 and stripped.endswith("?") and "\n" not in stripped:
        return True
    norm_q = re.sub(r"[^\w\s]", "", user_message.casefold()).split()
    norm_a = re.sub(r"[^\w\s]", "", stripped.casefold()).split()
    if norm_q and len(norm_a) <= len(norm_q) + 5:
        overlap = sum(1 for w in norm_a if w in set(norm_q))
        if overlap / max(len(norm_a), 1) >= 0.65:
            return True
    return False


class ChatService:
    def __init__(self, session: AsyncSession, provider: AIProvider, settings: Settings) -> None:
        self.session = session
        self.provider = provider
        self.settings = settings

    async def ask(self, user: User, project_id: uuid.UUID, data: ChatRequest) -> ChatResponse:
        project = await get_owned_project(self.session, user, project_id)
        if greeting := _greeting_reply(data.message, project.title, bool(data.history)):
            return greeting
        project_id = project.id
        user_id = user.id
        context, references = await build_project_context(self.session, project)
        await self.session.rollback()

        messages = build_chat_messages(context, data.history, data.message)
        outcome = await timed_call(
            self.provider.generate_structured(messages, ChatAnswer),
            self.settings.ai_timeout_seconds,
        )
        # Si un modelo pequeño solo parafraseó la pregunta, reintentamos forzando respuesta
        if outcome.result is not None and _is_question_echo(
            data.message, outcome.result.data.answer
        ):
            retry_messages = [
                *messages[:-1],
                AIMessage(
                    "user",
                    f"Pregunta del usuario: {data.message}\n\n"
                    "IMPORTANTE: Tu intento anterior solo repitió la pregunta "
                    f"('{outcome.result.data.answer}'). NO escribas una pregunta. "
                    "Redacta ahora mismo una respuesta completa de varios párrafos "
                    "explicando ventajas, riesgos, factores clave y recomendaciones.",
                ),
            ]
            retry_outcome = await timed_call(
                self.provider.generate_structured(retry_messages, ChatAnswer),
                self.settings.ai_timeout_seconds,
            )
            if retry_outcome.result is not None:
                outcome = retry_outcome
        usage = outcome.result.usage if outcome.result else None
        self.session.add_all(
            build_call_logs(
                AICallContext(user_id=user_id, project_id=project_id),
                self.provider,
                AIOperation.CHAT,
                CHAT_PROMPT_VERSION,
                outcome,
                usage,
            )
        )
        await self.session.commit()

        if outcome.result is None:
            error = outcome.error or AIProviderError()
            raise ServiceUnavailableError(
                _CHAT_ERROR_MESSAGES.get(error.code, _CHAT_ERROR_MESSAGES["ai_error"]),
                code=error.code,
            )

        seen: set[str] = set()
        cited = []
        for finding_id in outcome.result.data.finding_ids:
            key = str(finding_id)
            if key in references and key not in seen:
                seen.add(key)
                cited.append(references[key])
        return ChatResponse(
            answer=outcome.result.data.answer,
            references=cited,
            provider=outcome.result.provider or self.provider.name,
            model=outcome.result.model or self.provider.model,
        )
