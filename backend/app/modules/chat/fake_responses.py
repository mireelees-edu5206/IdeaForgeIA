"""Provee respuestas deterministas para pruebas. Area: asistente contextual.

ARCHIVO: backend/app/modules/chat/fake_responses.py

¿Qué es?
La respuesta de mentira del asistente. Cuando el proveedor de pruebas está activo, en lugar de
llamar a una IA real, devuelve siempre el mismo texto de prueba.

¿Para qué sirve?
Para probar el chat sin gastar en IA. El texto lleva la marca [Simulado] para que no se confunda
con una respuesta real.

¿Quién lo usa?
El proveedor falso (ai/providers/fake.py) cuando el chat pide un ChatAnswer.
"""

from collections.abc import Sequence

from app.modules.ai.providers.fake import register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.chat.schemas import ChatAnswer


@register_fake_response(ChatAnswer)
def chat_answer(messages: Sequence[AIMessage]) -> ChatAnswer:
    """Devuelve siempre la misma respuesta de prueba, sin mirar el mensaje."""
    return ChatAnswer(
        answer=(
            "[Simulado] El asistente contextual está activo. "
            "Esta respuesta de prueba no analiza ni verifica la información del proyecto."
        )
    )
