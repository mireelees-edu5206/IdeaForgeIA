"""Expone endpoints HTTP del dominio. Area: asistente contextual.

ARCHIVO: backend/app/modules/chat/router.py

¿Qué es?
La puerta de entrada del asistente del proyecto. Tiene una sola ruta: enviar un mensaje y
recibir una respuesta.

¿Para qué sirve?
Para que la persona pueda preguntarle a la IA sobre su proyecto (por ejemplo, si conviene abrir
un negocio en cierta zona) y recibir una respuesta con referencias a los hallazgos que la respaldan.

Ruta:
- POST /api/v1/projects/{project_id}/chat: envía un mensaje y devuelve la respuesta.

¿Quién lo usa?
El frontend (features/chat). main.py lo conecta a la aplicación.

Importante: la ruta exige sesión (CurrentUser), y el servicio revisa que el proyecto
sea del usuario.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.ai.providers.base import AIProvider
from app.modules.chat.schemas import ChatRequest, ChatResponse
from app.modules.chat.service import ChatService

# La ruta cuelga de /projects/{project_id}/chat y se agrupa como "chat" en /docs.
router = APIRouter(prefix="/projects/{project_id}/chat", tags=["chat"])


def get_ai_provider(request: Request) -> AIProvider:
    """Entrega el proveedor de IA que se creó al arrancar el servidor (ver main.py)."""
    return request.app.state.ai_provider


# Atajo de tipo para no repetir la dependencia en las firmas.
Provider = Annotated[AIProvider, Depends(get_ai_provider)]


def get_chat_service(db: DbSession, provider: Provider, settings: AppSettings) -> ChatService:
    """Crea el servicio del chat con la sesión, el proveedor y la configuración."""
    return ChatService(db, provider, settings)


Service = Annotated[ChatService, Depends(get_chat_service)]


@router.post("", response_model=ChatResponse)
async def send_message(
    project_id: uuid.UUID, data: ChatRequest, user: CurrentUser, service: Service
) -> ChatResponse:
    """Envía un mensaje al asistente y devuelve su respuesta con las referencias."""
    return await service.ask(user, project_id, data)
