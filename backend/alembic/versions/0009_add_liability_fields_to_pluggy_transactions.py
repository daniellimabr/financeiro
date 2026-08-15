"""add liability fields to pluggy_transactions

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pluggy_transactions",
        sa.Column("liability_id", sa.Integer(), sa.ForeignKey("liabilities.id"), nullable=True),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "liability_sugerido_id", sa.Integer(), sa.ForeignKey("liabilities.id"), nullable=True
        ),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column("liability_sugestao_confianca", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pluggy_transactions", "liability_sugestao_confianca")
    op.drop_column("pluggy_transactions", "liability_sugerido_id")
    op.drop_column("pluggy_transactions", "liability_id")
