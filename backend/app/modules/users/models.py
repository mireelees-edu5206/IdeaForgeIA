import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, String, true
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("char_length(email) <= 254", name="email_length"),
        CheckConstraint("btrim(full_name) <> ''", name="full_name_not_blank"),
    )

    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    supabase_user_id: Mapped[uuid.UUID | None] = mapped_column(unique=True)
    password_hash: Mapped[str]
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[UserRole] = mapped_column(
        str_enum(UserRole, "role", 10), server_default=UserRole.USER.value
    )
    is_active: Mapped[bool] = mapped_column(server_default=true())
    last_login_at: Mapped[datetime | None]
