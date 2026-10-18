import uuid
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AIProviderName
from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, str_enum


class AIOperation(StrEnum):
    IDEA_STRUCTURING = "idea_structuring"
    RESEARCH_PLANNING = "research_planning"
    GROUNDED_SEARCH = "grounded_search"
    EXTRACTION = "extraction"
    ANALYSIS = "analysis"
    REPORT_GENERATION = "report_generation"
    CHAT = "chat"


class AICallStatus(StrEnum):
    SUCCESS = "success"
    ERROR = "error"


class AIApiLog(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Auditoría de llamadas a la IA. Nunca guarda API keys ni prompts completos."""

    __tablename__ = "ai_api_logs"
    __table_args__ = (
        CheckConstraint(
            "coalesce(input_tokens, 0) >= 0 AND coalesce(output_tokens, 0) >= 0"
            " AND search_queries_count >= 0 AND coalesce(latency_ms, 0) >= 0"
            " AND coalesce(estimated_cost_usd, 0) >= 0",
            name="non_negative_metrics",
        ),
        Index("ix_ai_api_logs_user_id_created_at", "user_id", text("created_at DESC")),
        Index("ix_ai_api_logs_created_at", "created_at"),
    )

    # SET NULL: se conserva el registro de consumo aunque se borre el usuario o el proyecto.
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    research_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("research_runs.id", ondelete="SET NULL"), index=True
    )
    provider: Mapped[AIProviderName] = mapped_column(str_enum(AIProviderName, "provider"))
    model: Mapped[str] = mapped_column(String(100))
    operation: Mapped[AIOperation] = mapped_column(str_enum(AIOperation, "operation", 30))
    prompt_version: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[AICallStatus] = mapped_column(str_enum(AICallStatus, "status", 10))
    error_code: Mapped[str | None] = mapped_column(String(50))
    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    search_queries_count: Mapped[int] = mapped_column(server_default=text("0"))
    latency_ms: Mapped[int | None]
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 8))
