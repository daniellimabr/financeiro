"""categorizacao: apelido/sync_enabled em pluggy_accounts, descricao editavel
em pluggy_transactions, seed subcategoria Aluguel (receita)

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("pluggy_accounts", sa.Column("apelido", sa.String(length=255), nullable=True))
    op.add_column(
        "pluggy_accounts",
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.add_column(
        "pluggy_transactions",
        sa.Column("descricao_usuario", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column("descricao_sugerida", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "descricao_sugestao_origem_id",
            sa.Integer(),
            sa.ForeignKey("pluggy_transactions.id"),
            nullable=True,
        ),
    )

    op.execute(
        """
        INSERT INTO subcategories (group_id, nome, created_at, updated_at)
        SELECT id, 'Aluguel', now(), now()
        FROM category_groups
        WHERE nome = 'Receitas'
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM subcategories
        WHERE nome = 'Aluguel'
          AND group_id = (SELECT id FROM category_groups WHERE nome = 'Receitas')
        """
    )

    op.drop_column("pluggy_transactions", "descricao_sugestao_origem_id")
    op.drop_column("pluggy_transactions", "descricao_sugerida")
    op.drop_column("pluggy_transactions", "descricao_usuario")

    op.drop_column("pluggy_accounts", "sync_enabled")
    op.drop_column("pluggy_accounts", "apelido")
