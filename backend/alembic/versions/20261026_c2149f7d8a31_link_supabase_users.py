"""Vincula cada usuario local con su cuenta de Supabase.

ARCHIVO: backend/alembic/versions/20261026_c2149f7d8a31_link_supabase_users.py

¿Qué es?
Agrega `users.supabase_user_id` (UUID, opcional y único). Permite que una cuenta de Supabase
apunte a un perfil local, y así conservar el rol de administrador.

¿Quién la usa?
`alembic upgrade head`. El modelo está en `users/models.py`.
"""

import sqlalchemy as sa

from alembic import op

revision = "c2149f7d8a31"
down_revision = "3f9c5a1b2d4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Agrega la columna `supabase_user_id` y su restricción de unicidad."""
    op.add_column("users", sa.Column("supabase_user_id", sa.Uuid(), nullable=True))
    op.create_unique_constraint("uq_users_supabase_user_id", "users", ["supabase_user_id"])


def downgrade() -> None:
    """Quita la restricción de unicidad y la columna `supabase_user_id`."""
    op.drop_constraint("uq_users_supabase_user_id", "users", type_="unique")
    op.drop_column("users", "supabase_user_id")
