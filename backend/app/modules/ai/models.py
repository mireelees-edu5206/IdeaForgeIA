"""Define entidades ORM y restricciones de persistencia. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/models.py

¿Qué es?
La tabla "ai_api_logs" de la base de datos, que es la bitácora de cada llamada a la IA:
quién la pidió, para qué operación, con qué proveedor y modelo, si salió bien o mal, cuántos
tokens consumió, cuánto tardó y cuánto costó.

¿Para qué sirve?
Para vigilar el uso y el costo de la IA y para ver qué falló. La pantalla de administración
lee estos registros para mostrar la bitácora y las métricas.

¿Quién lo usa?
- calls.py crea los registros.
- admin (administración) y las métricas los leen.

Privacidad: nunca se guardan claves de acceso ni los textos completos de los mensajes.
"""

import uuid
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AIProviderName
from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, str_enum


class AIOperation(StrEnum):
    """Para qué se usó la IA en esa llamada (cada valor es una pantalla o proceso del sistema)."""

    IDEA_STRUCTURING = "idea_structuring"  # Ordenar la idea que escribió la persona.
    RESEARCH_PLANNING = "research_planning"  # Planear las preguntas de la investigación.
    GROUNDED_SEARCH = "grounded_search"  # Buscar en internet y citar fuentes.
    EXTRACTION = "extraction"  # Sacar hallazgos de la evidencia encontrada.
    ANALYSIS = "analysis"  # Armar oportunidades, riesgos, hipótesis y preguntas.
    REPORT_GENERATION = "report_generation"  # Redactar el veredicto final.
    CHAT = "chat"  # Responder preguntas del asistente.


class AICallStatus(StrEnum):
    """Resultado de una llamada: salió bien o falló."""

    SUCCESS = "success"
    ERROR = "error"


class AIApiLog(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Auditoría de llamadas a la IA. Nunca guarda API keys ni prompts completos.

    Cada fila es un intento a un proveedor. Si el proveedor principal falla y el de respaldo
    responde, quedan dos filas para la misma operación.
    """

    __tablename__ = "ai_api_logs"
    __table_args__ = (
        # Revisión de la base: ningún conteo puede ser negativo.
        CheckConstraint(
            "coalesce(input_tokens, 0) >= 0 AND coalesce(output_tokens, 0) >= 0"
            " AND search_queries_count >= 0 AND coalesce(latency_ms, 0) >= 0"
            " AND coalesce(estimated_cost_usd, 0) >= 0",
            name="non_negative_metrics",
        ),
        # Índices para buscar rápido por usuario y por fecha.
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
    # Proveedor y modelo que respondieron (o intentaron responder).
    provider: Mapped[AIProviderName] = mapped_column(str_enum(AIProviderName, "provider"))
    model: Mapped[str] = mapped_column(String(100))
    operation: Mapped[AIOperation] = mapped_column(str_enum(AIOperation, "operation", 30))
    # Versión del texto de instrucciones usado, para saber qué prompt generó el resultado.
    prompt_version: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[AICallStatus] = mapped_column(str_enum(AICallStatus, "status", 10))
    # Código del error si falló (por ejemplo "ai_timeout"). Vacío si salió bien.
    error_code: Mapped[str | None] = mapped_column(String(50))
    # Tokens enviados y recibidos. Pueden ser vacíos si el proveedor no los informa.
    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    # Cuántas búsquedas en internet se hicieron. Por defecto 0.
    search_queries_count: Mapped[int] = mapped_column(server_default=text("0"))
    # Milisegundos que tardó la llamada.
    latency_ms: Mapped[int | None]
    # Costo estimado en dólares, con 8 decimales.
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 8))
