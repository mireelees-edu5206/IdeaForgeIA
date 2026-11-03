"""Define entidades ORM y restricciones de persistencia. Area: investigacion web.

ARCHIVO: backend/app/modules/research/models.py

¿Qué es?
Las tablas de la investigación en la base de datos, y los estados que puede tener cada cosa:
- research_runs: una investigación completa sobre un proyecto (por ejemplo, "investigar la idea
  de la panadería").
- research_queries: cada pregunta dentro de una investigación (mercado, clientes, competencia...).
- sources: cada página web encontrada. Se guarda una sola vez por proyecto aunque la citen varias
  preguntas.
- research_query_sources: la tabla que une preguntas con fuentes.
  Dice qué fuentes usó cada pregunta.

¿Para qué sirve?
Para guardar todo lo que la IA encuentra, de forma que se pueda consultar, citar y revisar después.

¿Quién lo usa?
repository.py (consultas), service.py (reglas), orchestrator.py (escribe el avance de la
investigación) y las migraciones de Alembic.

Reglas importantes que la base de datos hace cumplir (aunque el código falle):
- Un proyecto solo puede tener una investigación activa (pendiente o corriendo) a la vez.
- El avance (progress_pct) debe estar entre 0 y 100.
- La fecha de fin no puede ser anterior a la de inicio.
- Una pregunta no puede repetir la misma posición dentro de la misma investigación.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AIProviderName, ResearchCategory
from app.db.base import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class RunStatus(StrEnum):
    """Estado general de una investigación."""

    PENDING = "pending"  # Creada, todavía no empieza.
    RUNNING = "running"  # Corriendo ahora.
    COMPLETED = "completed"  # Terminó bien.
    FAILED = "failed"  # Terminó con un error.
    INTERRUPTED = "interrupted"  # Se quedó a medias (por ejemplo, el servidor se reinició).


# Los estados en los que una investigación todavía está en curso.
ACTIVE_RUN_STATUSES = (RunStatus.PENDING, RunStatus.RUNNING)


class RunStep(StrEnum):
    """En qué paso va una investigación en curso. Se muestra como avance en la pantalla."""

    PLANNING = "planning"  # Planeando las preguntas.
    SEARCHING = "searching"  # Buscando en internet.
    EXTRACTING = "extracting"  # Sacando hallazgos de las respuestas.
    ANALYZING = "analyzing"  # Armando oportunidades, riesgos e hipótesis.
    SCORING = "scoring"  # Calificando resultados.


class QueryStatus(StrEnum):
    """Estado de una pregunta individual dentro de la investigación."""

    PENDING = "pending"  # Esperando turno.
    COMPLETED = "completed"  # Respondida.
    FAILED = "failed"  # No se pudo responder.


class SourceType(StrEnum):
    """Tipo de sitio de una fuente. Sirve para saber qué tan confiable puede ser."""

    NEWS = "news"  # Periódicos y medios.
    COMPANY_SITE = "company_site"  # Sitio de una empresa.
    GOVERNMENT = "government"  # Sitio oficial del gobierno.
    ACADEMIC = "academic"  # Universidades y centros de investigación.
    MARKETPLACE = "marketplace"  # Tiendas o plataformas de venta.
    SOCIAL = "social"  # Redes sociales.
    BLOG = "blog"  # Blogs personales.
    REVIEW_SITE = "review_site"  # Sitios de reseñas.
    OTHER = "other"  # Otro tipo que no encaja arriba.
    UNKNOWN = "unknown"  # No se pudo clasificar.


def research_run_fk(ondelete: str) -> ForeignKeyConstraint:
    """Crea una llave foránea compuesta: (run_id, project_id).

    Sirve para garantizar que una pregunta o un vínculo apunte a una investigación
    del mismo proyecto.
    Así no se puede mezclar la investigación de un proyecto con otro.
    """
    return ForeignKeyConstraint(
        ["run_id", "project_id"],
        ["research_runs.id", "research_runs.project_id"],
        ondelete=ondelete,
    )


class ResearchRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Una investigación completa sobre un proyecto."""

    __tablename__ = "research_runs"
    __table_args__ = (
        UniqueConstraint("id", "project_id"),
        # El avance debe estar entre 0 y 100.
        CheckConstraint("progress_pct BETWEEN 0 AND 100", name="progress_range"),
        # Si hay fechas de inicio y fin, la de fin no puede ser anterior.
        CheckConstraint(
            "finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at",
            name="dates_order",
        ),
        # Índice para listar las investigaciones de un proyecto, de la más nueva a la más vieja.
        Index("ix_research_runs_project_id_created_at", "project_id", text("created_at DESC")),
        # Una sola ejecución activa por proyecto.
        Index(
            "uq_research_runs_one_active",
            "project_id",
            unique=True,
            postgresql_where=text(
                "status IN (" + ", ".join(f"'{s.value}'" for s in ACTIVE_RUN_STATUSES) + ")"
            ),
        ),
    )

    # Si se borra el proyecto, se borran sus investigaciones (CASCADE).
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # Estado general. Empieza en "pending" si no se indica otra cosa.
    status: Mapped[RunStatus] = mapped_column(
        str_enum(RunStatus, "status"), server_default=RunStatus.PENDING.value
    )
    # Paso actual. Vacío si no hay paso activo.
    current_step: Mapped[RunStep | None] = mapped_column(str_enum(RunStep, "current_step"))
    # Avance de 0 a 100. Empieza en 0.
    progress_pct: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    # Qué proveedor de IA y qué modelo se usaron. Se guardan para saber con qué se hizo.
    ai_provider: Mapped[AIProviderName] = mapped_column(str_enum(AIProviderName, "ai_provider"))
    ai_model: Mapped[str] = mapped_column(String(100))
    # Código y mensaje del error si falló. Vacíos si todo salió bien.
    error_code: Mapped[str | None] = mapped_column(String(50))
    error_message: Mapped[str | None]
    # Cuándo empezó y cuándo terminó. Vacíos mientras no ocurra.
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]


class ResearchQuery(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Una pregunta de la investigación, con su respuesta de la IA."""

    __tablename__ = "research_queries"
    __table_args__ = (
        # Dentro de una investigación, cada posición (1, 2, 3...) aparece una sola vez.
        UniqueConstraint("run_id", "position"),
        # Las búsquedas ejecutadas deben guardarse como lista (array), no como otro tipo de dato.
        CheckConstraint("jsonb_typeof(executed_queries) = 'array'", name="executed_queries_array"),
    )

    # A qué investigación pertenece. Si se borra la investigación, se borran sus preguntas.
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"))
    # Orden de la pregunta: 1, 2, 3...
    position: Mapped[int] = mapped_column(SmallInteger)
    # Tema de la pregunta: mercado, clientes, competencia, etc.
    category: Mapped[ResearchCategory] = mapped_column(str_enum(ResearchCategory, "category"))
    # El texto de la pregunta.
    question: Mapped[str]
    # Estado de la pregunta. Empieza en "pending".
    status: Mapped[QueryStatus] = mapped_column(
        str_enum(QueryStatus, "status"), server_default=QueryStatus.PENDING.value
    )
    # Respuesta con grounding; los spans de la evidencia apuntan a este texto.
    response_text: Mapped[str | None]
    # Lista de búsquedas que hizo la IA en internet. Por defecto, una lista vacía.
    executed_queries: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    # HTML de Google Search Suggestions (Gemini). Se muestra solo en un iframe sandbox.
    search_suggestions_html: Mapped[str | None]
    # Cuándo se completó. Vacío mientras no se complete.
    completed_at: Mapped[datetime | None]


class Source(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Una página web encontrada durante la investigación. Se guarda una sola vez por proyecto."""

    __tablename__ = "sources"
    __table_args__ = (
        # Dentro de un proyecto, una dirección canónica aparece una sola vez (evita duplicados).
        UniqueConstraint("project_id", "canonical_url"),
        UniqueConstraint("id", "project_id"),
        # Índice para buscar fuentes de un proyecto por dominio.
        Index("ix_sources_project_id_domain", "project_id", "domain"),
    )

    # A qué proyecto pertenece. Si se borra el proyecto, se borran sus fuentes.
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # La dirección tal como llegó.
    url: Mapped[str]
    # La dirección limpia (sin rastreo, sin www.), que se usa para comparar fuentes.
    canonical_url: Mapped[str]
    # El dominio, por ejemplo "ejemplo.com". Máximo 255 caracteres.
    domain: Mapped[str] = mapped_column(String(255))
    # Título de la página; vacío si no se conoce.
    title: Mapped[str | None]
    # Tipo de fuente. Empieza como "desconocida" si no se clasifica.
    source_type: Mapped[SourceType] = mapped_column(
        str_enum(SourceType, "source_type"), server_default=SourceType.UNKNOWN.value
    )
    # Fecha de publicación de la página; vacía si no se conoce.
    published_at: Mapped[datetime | None]


class ResearchQuerySource(Base):
    """El vínculo entre una pregunta y una fuente: qué fuentes usó cada pregunta."""

    __tablename__ = "research_query_sources"

    # Juntas, las dos columnas forman la llave primaria: cada par (pregunta, fuente) aparece una
    # vez.
    # Si se borra la pregunta o la fuente, se borra el vínculo.
    query_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("research_queries.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    # False = el proveedor visitó la URL pero no la citó en la respuesta.
    was_cited: Mapped[bool]
    # Posición de la fuente en los resultados. Vacía si no se conoce.
    rank: Mapped[int | None] = mapped_column(SmallInteger)
