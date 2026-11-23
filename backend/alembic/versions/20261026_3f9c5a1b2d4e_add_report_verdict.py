"""Agrega el alcance geográfico de los informes y el veredicto estructurado.

ARCHIVO: backend/alembic/versions/20261026_3f9c5a1b2d4e_add_report_verdict.py

¿Qué es?
Agrega `reports.geographic_scopes` (lista de zonas, por defecto vacía) y `report_sections.verdict`
(JSONB, solo en el resumen).

¿Quién la usa?
`alembic upgrade head`. Revisa `reports/models.py` para ver los campos correspondientes.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "3f9c5a1b2d4e"
down_revision = "95f14ef1a15d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Agrega las columnas `geographic_scopes` a reports y `verdict` a report_sections."""
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
    """Elimina las dos columnas agregadas en upgrade."""
    op.drop_column("report_sections", "verdict")
    op.drop_column("reports", "geographic_scopes")
