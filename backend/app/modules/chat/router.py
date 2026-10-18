import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.deps import AppSettings, CurrentUser, DbSession
from app.modules.ai.providers.base import AIProvider
from app.modules.chat.schemas import ChatRequest, ChatResponse
from app.modules.chat.service import ChatService

router = APIRouter(prefix="/projects/{project_id}/chat", tags=["chat"])


def get_ai_provider(request: Request) -> AIProvider:
    return request.app.state.ai_provider


Provider = Annotated[AIProvider, Depends(get_ai_provider)]


def get_chat_service(db: DbSession, provider: Provider, settings: AppSettings) -> ChatService:
    return ChatService(db, provider, settings)


Service = Annotated[ChatService, Depends(get_chat_service)]


@router.post("", response_model=ChatResponse)
async def send_message(
    project_id: uuid.UUID, data: ChatRequest, user: CurrentUser, service: Service
) -> ChatResponse:
    return await service.ask(user, project_id, data)
