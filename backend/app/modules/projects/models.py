import uuid
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AttributeType, Origin
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, str_enum

RAW_IDEA_MIN_LENGTH = 20
RAW_IDEA_MAX_LENGTH = 5000
ATTRIBUTE_VALUE_MAX_LENGTH = 4000


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    STRUCTURED = "structured"
    RESEARCHING = "researching"
    ANALYZED = "analyzed"


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("btrim(title) <> ''", name="title_not_blank"),
        CheckConstraint(
            f"char_length(raw_idea) BETWEEN {RAW_IDEA_MIN_LENGTH} AND {RAW_IDEA_MAX_LENGTH}",
            name="raw_idea_length",
        ),
        Index("ix_projects_user_id_updated_at", "user_id", text("updated_at DESC")),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    raw_idea: Mapped[str]
    status: Mapped[ProjectStatus] = mapped_column(
        str_enum(ProjectStatus, "status"), server_default=ProjectStatus.DRAFT.value
    )


class IdeaAttribute(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "idea_attributes"
    __table_args__ = (
        UniqueConstraint("project_id", "attribute_type", "position"),
        CheckConstraint(
            f"char_length(value) BETWEEN 1 AND {ATTRIBUTE_VALUE_MAX_LENGTH}", name="value_length"
        ),
        CheckConstraint("position >= 0", name="position_non_negative"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    attribute_type: Mapped[AttributeType] = mapped_column(
        str_enum(AttributeType, "attribute_type", 30)
    )
    value: Mapped[str]
    # Permite varios valores del mismo tipo (p. ej. varios canales).
    position: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    origin: Mapped[Origin] = mapped_column(str_enum(Origin, "origin", 10))
    is_confirmed: Mapped[bool] = mapped_column(server_default=false())
