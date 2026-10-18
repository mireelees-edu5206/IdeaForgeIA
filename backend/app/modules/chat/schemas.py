import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.core.enums import AIProviderName, Level, Origin, ResearchCategory, ReviewStatus

ChatText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
ChatHistoryText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)
]


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: ChatHistoryText


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: ChatText
    history: list[ChatTurn] = Field(default_factory=list, max_length=14)

    @model_validator(mode="after")
    def limit_conversation_size(self) -> "ChatRequest":
        if len(self.message) + sum(len(turn.content) for turn in self.history) > 3000:
            raise ValueError("La conversación es demasiado larga; inicia una conversación nueva.")
        return self


class ChatAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    finding_ids: list[uuid.UUID] = Field(default_factory=list, max_length=10)


class ChatEvidenceReference(BaseModel):
    stance: Literal["supports", "contradicts", "context"]
    content: str
    source_url: str | None
    source_title: str | None
    source_domain: str


class ChatFindingReference(BaseModel):
    id: uuid.UUID
    finding_type: ResearchCategory
    statement: str
    confidence_level: Level
    origin: Origin
    review_status: ReviewStatus
    evidence: list[ChatEvidenceReference]


class ChatResponse(BaseModel):
    answer: str
    references: list[ChatFindingReference]
    provider: AIProviderName | None = None
    model: str | None = None
