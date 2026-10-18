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
    COMPANY = "company"
    PRODUCT = "product"
    TECHNOLOGY = "technology"
    ORGANIZATION = "organization"
    OTHER = "other"


class CompetitorType(StrEnum):
    DIRECT = "direct"
    INDIRECT = "indirect"
    SUBSTITUTE = "substitute"
    ALTERNATIVE = "alternative"


class Entity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "entities"
    __table_args__ = (
        UniqueConstraint("project_id", "entity_type", "normalized_name"),
        UniqueConstraint("id", "project_id"),
        Index(
            "ix_entities_normalized_name_trgm",
            "normalized_name",
            postgresql_using="gin",
            postgresql_ops={"normalized_name": "gin_trgm_ops"},
        ),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    entity_type: Mapped[EntityType] = mapped_column(str_enum(EntityType, "entity_type"))
    name: Mapped[str] = mapped_column(String(200))
    # Minúsculas, sin acentos ni sufijos legales: base de la deduplicación.
    normalized_name: Mapped[str] = mapped_column(String(200))
    website: Mapped[str | None]
    description: Mapped[str | None]


class EntityAlias(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "entity_aliases"
    __table_args__ = (
        UniqueConstraint("entity_id", "normalized_alias"),
        Index(
            "ix_entity_aliases_normalized_alias_trgm",
            "normalized_alias",
            postgresql_using="gin",
            postgresql_ops={"normalized_alias": "gin_trgm_ops"},
        ),
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"))
    alias: Mapped[str] = mapped_column(String(200))
    normalized_alias: Mapped[str] = mapped_column(String(200))


class Competitor(UUIDPrimaryKeyMixin, ReviewableMixin, TimestampMixin, Base):
    __tablename__ = "competitors"
    __table_args__ = (
        UniqueConstraint("project_id", "entity_id"),
        ForeignKeyConstraint(
            ["entity_id", "project_id"], ["entities.id", "entities.project_id"], ondelete="CASCADE"
        ),
        research_run_fk(ondelete="SET NULL (run_id)"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    entity_id: Mapped[uuid.UUID]
    run_id: Mapped[uuid.UUID | None]
    competitor_type: Mapped[CompetitorType] = mapped_column(
        str_enum(CompetitorType, "competitor_type", 15)
    )
    # ANÁLISIS: justificación de la clasificación, no un hecho comprobado.
    rationale: Mapped[str | None]
    threat_level: Mapped[Level] = mapped_column(
        str_enum(Level, "threat_level", 15), server_default=Level.UNDETERMINED.value
    )
