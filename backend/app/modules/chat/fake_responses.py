from collections.abc import Sequence

from app.modules.ai.providers.fake import register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.chat.schemas import ChatAnswer


@register_fake_response(ChatAnswer)
def chat_answer(messages: Sequence[AIMessage]) -> ChatAnswer:
    return ChatAnswer(
        answer=(
            "[Simulado] El asistente contextual está activo. "
            "Esta respuesta de prueba no analiza ni verifica la información del proyecto."
        )
    )
