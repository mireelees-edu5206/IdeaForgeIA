import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import AIProviderName
from app.core.schemas import PatchModel
from app.modules.ai.models import AICallStatus, AIOperation
from app.modules.projects.models import ProjectStatus
from app.modules.users.models import UserRole


class ProviderMetrics(BaseModel):
    provider: AIProviderName
    total_calls: int
    success_calls: int
    error_calls: int
    avg_latency_ms: int | None
    input_tokens: int
    output_tokens: int
    search_queries: int
    estimated_cost_usd: Decimal


class AdminAILogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_email: str | None = None
    project_title: str | None = None
    provider: AIProviderName
    model: str
    operation: AIOperation
    prompt_version: str | None
    status: AICallStatus
    error_code: str | None
    input_tokens: int | None
    output_tokens: int | None
    search_queries_count: int
    latency_ms: int | None
    estimated_cost_usd: Decimal | None
    created_at: datetime


class AdminOverview(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    total_projects: int
    projects_by_status: dict[ProjectStatus, int]
    total_research_runs: int
    completed_research_runs: int
    failed_research_runs: int
    total_findings: int
    total_reports: int
    total_ai_calls: int
    ai_by_provider: list[ProviderMetrics]
    recent_ai_logs: list[AdminAILogRead]


class AdminUserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    project_count: int
    research_run_count: int
    last_login_at: datetime | None
    created_at: datetime


class AdminUserUpdate(PatchModel):
    role: UserRole | None = None
    is_active: bool | None = None
