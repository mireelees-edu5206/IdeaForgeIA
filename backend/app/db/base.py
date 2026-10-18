import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, FetchedValue, MetaData, Text, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.enums import Origin, ReviewStatus

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {datetime: DateTime(timezone=True), str: Text}
    # Recupera con RETURNING los valores generados por la BD (id, created_at, updated_at)
    # para evitar cargas implícitas, que en modo async fallan.
    __mapper_args__ = {"eager_defaults": True}


def str_enum(enum_cls: type[StrEnum], name: str, length: int = 20) -> Enum:
    """VARCHAR + CHECK (no ENUM nativo). `name` da nombre al CHECK: ck_<tabla>_<name>."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=length,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("uuidv7()"), sort_order=-100
    )


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), sort_order=100)


class TimestampMixin(CreatedAtMixin):
    # El trigger set_updated_at() lo mantiene; FetchedValue indica al ORM que lo relea.
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), server_onupdate=FetchedValue(), sort_order=101
    )


class ReviewableMixin:
    """Procedencia (IA/usuario) y revisión de los elementos que puede generar la IA."""

    origin: Mapped[Origin] = mapped_column(str_enum(Origin, "origin", 10), sort_order=90)
    review_status: Mapped[ReviewStatus] = mapped_column(
        str_enum(ReviewStatus, "review_status", 10),
        server_default=ReviewStatus.PROPOSED.value,
        sort_order=91,
    )
