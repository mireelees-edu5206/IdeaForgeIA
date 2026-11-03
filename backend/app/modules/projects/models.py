"""Define entidades ORM y restricciones de persistencia. Area: proyectos.

ARCHIVO: backend/app/modules/projects/models.py

¿Qué es?
Las tablas de la idea en la base de datos:
- projects: cada proyecto (una idea de negocio) con su título, su texto original y su estado.
- idea_attributes: las partes de la idea (problema, solución, segmento de clientes...), cada una
  con su valor, su origen (la persona o la IA) y si ya fue confirmada.

¿Para qué sirve?
Para guardar la idea y saber en qué etapa va: borrador, estructurada, investigando o analizada.

¿Quién lo usa?
repository.py, service.py, schemas.py y casi todos los módulos que cuelgan de un proyecto.

Reglas importantes que la base de datos hace cumplir:
- El título no puede estar vacío.
- La idea debe tener entre 20 y 5000 caracteres.
- Cada parte de la idea puede repetirse, pero cada posición aparece una sola vez.
- El valor de un atributo tiene entre 1 y 4000 caracteres.
"""

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

# Longitudes permitidas para la idea y sus valores. Cambiarlas exige una migración.
RAW_IDEA_MIN_LENGTH = 20
RAW_IDEA_MAX_LENGTH = 5000
ATTRIBUTE_VALUE_MAX_LENGTH = 4000


class ProjectStatus(StrEnum):
    """En qué etapa va el proyecto."""

    DRAFT = "draft"  # Borrador: la idea todavía se está escribiendo o cambiando.
    STRUCTURED = "structured"  # La estructura de la idea está confirmada, lista para investigar.
    RESEARCHING = "researching"  # Hay una investigación en curso.
    ANALYZED = "analyzed"  # La investigación y el análisis ya están listos.


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Un proyecto: una idea de negocio con su título, su texto original y su etapa."""

    __tablename__ = "projects"
    __table_args__ = (
        # El título no puede ser solo espacios.
        CheckConstraint("btrim(title) <> ''", name="title_not_blank"),
        # La idea debe tener entre 20 y 5000 caracteres.
        CheckConstraint(
            f"char_length(raw_idea) BETWEEN {RAW_IDEA_MIN_LENGTH} AND {RAW_IDEA_MAX_LENGTH}",
            name="raw_idea_length",
        ),
        # Índice para listar los proyectos de un usuario, del más reciente al más antiguo.
        Index("ix_projects_user_id_updated_at", "user_id", text("updated_at DESC")),
    )

    # Dueño del proyecto. Si se borra el usuario, se borran sus proyectos.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Nombre corto del proyecto, de hasta 200 letras.
    title: Mapped[str] = mapped_column(String(200))
    # Texto original de la idea, tal como la escribió la persona.
    raw_idea: Mapped[str]
    # Etapa actual. Empieza en borrador.
    status: Mapped[ProjectStatus] = mapped_column(
        str_enum(ProjectStatus, "status"), server_default=ProjectStatus.DRAFT.value
    )


class IdeaAttribute(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Una parte de la idea (por ejemplo, el problema) con su valor y su origen."""

    __tablename__ = "idea_attributes"
    __table_args__ = (
        # Dentro de un proyecto, cada posición de cada tipo aparece una sola vez.
        UniqueConstraint("project_id", "attribute_type", "position"),
        # El valor debe tener entre 1 y 4000 caracteres.
        CheckConstraint(
            f"char_length(value) BETWEEN 1 AND {ATTRIBUTE_VALUE_MAX_LENGTH}", name="value_length"
        ),
        # La posición nunca puede ser negativa.
        CheckConstraint("position >= 0", name="position_non_negative"),
    )

    # Proyecto al que pertenece. Si se borra el proyecto, se borran sus atributos.
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # Qué parte de la idea es (problema, solución, canales...).
    attribute_type: Mapped[AttributeType] = mapped_column(
        str_enum(AttributeType, "attribute_type", 30)
    )
    # El texto de esa parte.
    value: Mapped[str]
    # Permite varios valores del mismo tipo (p. ej. varios canales).
    position: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    # Quién lo escribió: la persona o la IA.
    origin: Mapped[Origin] = mapped_column(str_enum(Origin, "origin", 10))
    # Si ya fue confirmado. Por defecto, no.
    is_confirmed: Mapped[bool] = mapped_column(server_default=false())
