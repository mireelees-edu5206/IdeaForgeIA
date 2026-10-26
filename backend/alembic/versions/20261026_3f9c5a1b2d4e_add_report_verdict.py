import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "3f9c5a1b2d4e"
down_revision = "95f14ef1a15d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reports",
        sa.Column(
            "geographic_scopes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "report_sections",
        sa.Column(
            "verdict",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("report_sections", "verdict")
    op.drop_column("reports", "geographic_scopes")
