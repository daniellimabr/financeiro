"""dashboards: excluir_de_totais em category_groups + backfill data_competencia

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "category_groups",
        sa.Column("excluir_de_totais", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        "UPDATE category_groups SET excluir_de_totais = true WHERE nome = 'Transferência interna'"
    )

    op.execute(
        "UPDATE pluggy_transactions SET data_competencia = data WHERE data_competencia IS NULL"
    )

    op.create_index(
        "ix_pluggy_transactions_user_id_data_competencia",
        "pluggy_transactions",
        ["user_id", "data_competencia"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pluggy_transactions_user_id_data_competencia", table_name="pluggy_transactions"
    )
    op.drop_column("category_groups", "excluir_de_totais")
