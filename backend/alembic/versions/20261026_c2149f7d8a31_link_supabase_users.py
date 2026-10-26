import sqlalchemy as sa

from alembic import op

revision = "c2149f7d8a31"
down_revision = "3f9c5a1b2d4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supabase_user_id", sa.Uuid(), nullable=True))
    op.create_unique_constraint("uq_users_supabase_user_id", "users", ["supabase_user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_supabase_user_id", "users", type_="unique")
    op.drop_column("users", "supabase_user_id")
