"""pluggy_transactions.data_editada_manualmente — trava explícita contra
sobrescrita de `data`/`data_competencia`/`data_caixa` em resyncs futuros da
Pluggy, quando o usuário edita a data manualmente na tela Categorizar.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-17

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "data_editada_manualmente", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("pluggy_transactions", "data_editada_manualmente")
