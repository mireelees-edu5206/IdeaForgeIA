"""Define entidades ORM y restricciones de persistencia. Area: entidades.

ARCHIVO: backend/app/modules/entities/models.py

¿Qué es?
Las tablas de empresas, productos y competidores:
- entities: una empresa, producto, tecnología u organización mencionada en la investigación o
  agregada por la persona.
- entity_aliases: otros nombres con los que se conoce una entidad
  (por ejemplo, la marca y la razón social).
- competitors: una entidad clasificada como competidor de la idea,
  con su tipo y su nivel de amenaza.

¿Para qué sirve?
Para no repetir la misma empresa en cada hallazgo y para llevar la lista
de competencia del proyecto.

¿Quién lo usa?
normalize.py (compara nombres), repository.py y service.py (consultas y reglas),
findings/extraction.py
(guarda lo que propone la IA) y el chat y los informes (leen la competencia).

Importante: una clasificación de competidor es un análisis, no un hecho comprobado. Por eso la IA
la marca como propuesta, hasta que la persona la revise.
"""

import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, ForeignKeyConstraint, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import Level
from app.db.base import (
    Base,
    CreatedAtMixin,
    ReviewableMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
)
from app.modules.research.models import research_run_fk


class EntityType(StrEnum):
    """Qué clase de entidad es."""

    COMPANY = "company"  # Empresa o negocio.
    PRODUCT = "product"  # Producto o servicio concreto.
    TECHNOLOGY = "technology"  # Tecnología o herramienta.
    ORGANIZATION = "organization"  # Organización, cámara o asociación.
    OTHER = "other"  # Otro tipo.


class CompetitorType(StrEnum):
    """Qué tan parecida es una alternativa a la idea."""

    DIRECT = "direct"  # Hace lo mismo para el mismo cliente.
    INDIRECT = "indirect"  # Resuelve el mismo problema de otra forma.
    SUBSTITUTE = "substitute"  # Un producto que puede reemplazar a la idea.
    ALTERNATIVE = "alternative"  # Otra opción que el cliente podría elegir.


class Entity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Una empresa, producto, tecnología u organización mencionada en el proyecto."""

    __tablename__ = "entities"
    __table_args__ = (
        # Dentro de un proyecto, no puede haber dos entidades del mismo tipo con el mismo nombre
        # normalizado.
        UniqueConstraint("project_id", "entity_type", "normalized_name"),
        UniqueConstraint("id", "project_id"),
        # Índice de búsqueda por similitud de texto (trigramas), para encontrar nombres parecidos.
        Index(
            "ix_entities_normalized_name_trgm",
            "normalized_name",
            postgresql_using="gin",
            postgresql_ops={"normalized_name": "gin_trgm_ops"},
        ),
    )

    # A qué proyecto pertenece. Si se borra el proyecto, se borran sus entidades.
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # Qué clase de entidad es.
    entity_type: Mapped[EntityType] = mapped_column(str_enum(EntityType, "entity_type"))
    # El nombre tal como se escribió.
    name: Mapped[str] = mapped_column(String(200))
    # Minúsculas, sin acentos ni sufijos legales: base de la deduplicación.
    normalized_name: Mapped[str] = mapped_column(String(200))
    # Sitio web, si se conoce. Vacío si no.
    website: Mapped[str | None]
    # Descripción breve, si se conoce. Vacía si no.
    description: Mapped[str | None]


class EntityAlias(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Otro nombre con el que se conoce una entidad."""

    __tablename__ = "entity_aliases"
    __table_args__ = (
        # Una entidad no puede tener dos alias iguales.
        UniqueConstraint("entity_id", "normalized_alias"),
        # Índice de búsqueda por similitud de texto para los alias.
        Index(
            "ix_entity_aliases_normalized_alias_trgm",
            "normalized_alias",
            postgresql_using="gin",
            postgresql_ops={"normalized_alias": "gin_trgm_ops"},
        ),
    )

    # A qué entidad pertenece el alias. Si se borra la entidad, se borran sus alias.
    entity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"))
    # El nombre alternativo tal como se escribió.
    alias: Mapped[str] = mapped_column(String(200))
    # Versión normalizada del alias, para compararlo.
    normalized_alias: Mapped[str] = mapped_column(String(200))


class Competitor(UUIDPrimaryKeyMixin, ReviewableMixin, TimestampMixin, Base):
    """Una entidad clasificada como competidor de la idea, con su tipo y su nivel de amenaza."""

    __tablename__ = "competitors"
    __table_args__ = (
        # Una entidad solo puede ser competidora una vez dentro del proyecto.
        UniqueConstraint("project_id", "entity_id"),
        # La entidad debe ser del mismo proyecto que el competidor.
        ForeignKeyConstraint(
            ["entity_id", "project_id"], ["entities.id", "entities.project_id"], ondelete="CASCADE"
        ),
        # Si la investigación de origen se borra, el competidor se conserva (run_id queda vacío).
        research_run_fk(ondelete="SET NULL (run_id)"),
    )

    # A qué proyecto pertenece. Si se borra el proyecto, se borran sus competidores.
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # La entidad que es competidora.
    entity_id: Mapped[uuid.UUID]
    # De qué investigación salió. Vacío si lo agregó la persona.
    run_id: Mapped[uuid.UUID | None]
    # Qué tan parecida es a la idea.
    competitor_type: Mapped[CompetitorType] = mapped_column(
        str_enum(CompetitorType, "competitor_type", 15)
    )
    # ANÁLISIS: justificación de la clasificación, no un hecho comprobado.
    rationale: Mapped[str | None]
    # Qué tan fuerte parece la competencia. Empieza en indeterminado.
    threat_level: Mapped[Level] = mapped_column(
        str_enum(Level, "threat_level", 15), server_default=Level.UNDETERMINED.value
    )
