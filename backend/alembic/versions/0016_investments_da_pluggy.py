"""integracao completa de investments da pluggy: tabelas pluggy_investments e
pluggy_investment_transactions

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-18

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pluggy_investments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("pluggy_items.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pluggy_investment_id", sa.String(length=255), nullable=False, unique=True),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("subtipo", sa.String(length=50), nullable=True),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("codigo", sa.String(length=50), nullable=True),
        sa.Column("quantidade", sa.Numeric(20, 8), nullable=True),
        sa.Column("valor_investido", sa.Numeric(18, 6), nullable=True),
        sa.Column("valor_atual", sa.Numeric(14, 2), nullable=False),
        sa.Column("saldo_inicial", sa.Numeric(14, 2), nullable=True),
        sa.Column("moeda", sa.String(length=10), nullable=False, server_default="BRL"),
        sa.Column(
            "investimento_id", sa.Integer(), sa.ForeignKey("investimentos.id"), nullable=True
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_pluggy_investments_user_id", "pluggy_investments", ["user_id"])
    op.create_index(
        "ix_pluggy_investments_pluggy_investment_id",
        "pluggy_investments",
        ["pluggy_investment_id"],
        unique=True,
    )

    op.create_table(
        "pluggy_investment_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "investment_id", sa.Integer(), sa.ForeignKey("pluggy_investments.id"), nullable=False
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "pluggy_investment_transaction_id",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("descricao", sa.String(length=500), nullable=True),
        sa.Column("valor", sa.Numeric(18, 6), nullable=False),
        sa.Column("quantidade", sa.Numeric(20, 8), nullable=True),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_pluggy_investment_transactions_user_id",
        "pluggy_investment_transactions",
        ["user_id"],
    )
    # Nome encurtado — o nome "natural" (ix_..._pluggy_investment_transaction_id)
    # excede o limite de 63 caracteres de identificador do Postgres (achado real
    # no deploy da VM de dev: SQLite, usado nos testes, não tem esse limite).
    op.create_index(
        "ix_pluggy_investment_tx_ext_id",
        "pluggy_investment_transactions",
        ["pluggy_investment_transaction_id"],
        unique=True,
    )
    op.create_index(
        "ix_pluggy_investment_transactions_investment_id_data",
        "pluggy_investment_transactions",
        ["investment_id", "data"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pluggy_investment_transactions_investment_id_data",
        table_name="pluggy_investment_transactions",
    )
    op.drop_index(
        "ix_pluggy_investment_tx_ext_id",
        table_name="pluggy_investment_transactions",
    )
    op.drop_index(
        "ix_pluggy_investment_transactions_user_id", table_name="pluggy_investment_transactions"
    )
    op.drop_table("pluggy_investment_transactions")

    op.drop_index("ix_pluggy_investments_pluggy_investment_id", table_name="pluggy_investments")
    op.drop_index("ix_pluggy_investments_user_id", table_name="pluggy_investments")
    op.drop_table("pluggy_investments")
