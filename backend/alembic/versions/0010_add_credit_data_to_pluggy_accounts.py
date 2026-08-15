"""add credit limit and invoice due date to pluggy_accounts

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("pluggy_accounts", sa.Column("limite_credito", sa.Numeric(14, 2), nullable=True))
    op.add_column("pluggy_accounts", sa.Column("fatura_vencimento", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("pluggy_accounts", "fatura_vencimento")
    op.drop_column("pluggy_accounts", "limite_credito")
