"""add categorization and asset fields to pluggy_transactions

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-14

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

categorizacao_status_enum = postgresql.ENUM(
    "pendente", "confirmada", name="pluggy_transaction_categorizacao_status"
)
categorizacao_status_enum_no_create = postgresql.ENUM(
    "pendente",
    "confirmada",
    name="pluggy_transaction_categorizacao_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    categorizacao_status_enum.create(bind, checkfirst=True)

    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "categorizacao_status",
            categorizacao_status_enum_no_create,
            nullable=False,
            server_default="pendente",
        ),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "subcategoria_sugerida_id",
            sa.Integer(),
            sa.ForeignKey("subcategories.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "pluggy_transactions", sa.Column("sugestao_confianca", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "pluggy_transactions", sa.Column("sugestao_fonte_tipo", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "pluggy_transactions", sa.Column("sugestao_fonte_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "pluggy_transactions", sa.Column("sugestao_score", sa.Numeric(4, 3), nullable=True)
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column("asset_id", sa.Integer(), sa.ForeignKey("assets.id"), nullable=True),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column("asset_sugerido_id", sa.Integer(), sa.ForeignKey("assets.id"), nullable=True),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column("asset_sugestao_confianca", sa.String(length=20), nullable=True),
    )

    op.create_index(
        "ix_pluggy_transactions_user_id_categorizacao_status",
        "pluggy_transactions",
        ["user_id", "categorizacao_status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pluggy_transactions_user_id_categorizacao_status", table_name="pluggy_transactions"
    )
    op.drop_column("pluggy_transactions", "asset_sugestao_confianca")
    op.drop_column("pluggy_transactions", "asset_sugerido_id")
    op.drop_column("pluggy_transactions", "asset_id")
    op.drop_column("pluggy_transactions", "sugestao_score")
    op.drop_column("pluggy_transactions", "sugestao_fonte_id")
    op.drop_column("pluggy_transactions", "sugestao_fonte_tipo")
    op.drop_column("pluggy_transactions", "sugestao_confianca")
    op.drop_column("pluggy_transactions", "subcategoria_sugerida_id")
    op.drop_column("pluggy_transactions", "categorizacao_status")

    bind = op.get_bind()
    categorizacao_status_enum.drop(bind, checkfirst=True)
