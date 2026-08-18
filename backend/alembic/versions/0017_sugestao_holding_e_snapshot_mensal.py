"""vinculo holdings->investimento (sugestao) + serie historica mensal:
colunas de sugestao em pluggy_investments e tabela pluggy_investment_snapshots

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-18

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pluggy_investments",
        sa.Column(
            "investimento_sugerido_id",
            sa.Integer(),
            sa.ForeignKey("investimentos.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "pluggy_investments",
        sa.Column("investimento_sugestao_confianca", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "pluggy_investments",
        sa.Column("investimento_sugestao_fonte_tipo", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "pluggy_investments",
        sa.Column("investimento_sugestao_fonte_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "pluggy_investments",
        sa.Column("investimento_sugestao_score", sa.Numeric(4, 3), nullable=True),
    )

    op.create_table(
        "pluggy_investment_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "investment_id", sa.Integer(), sa.ForeignKey("pluggy_investments.id"), nullable=False
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ano_mes", sa.String(length=7), nullable=False),
        sa.Column("saldo", sa.Numeric(14, 2), nullable=False),
        sa.Column("valorizacao", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("rendimento", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("dividendos", sa.Numeric(14, 2), nullable=True),
        sa.Column("aportes", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("resgates", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("confianca", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_pluggy_investment_snapshots_user_id", "pluggy_investment_snapshots", ["user_id"]
    )
    op.create_index(
        "ix_pluggy_investment_snapshots_investment_id",
        "pluggy_investment_snapshots",
        ["investment_id"],
    )
    # Nome encurtado — mesmo achado da migration 0016: limite de 63 caracteres
    # de identificador do Postgres (SQLite dos testes não impõe esse limite).
    op.create_index(
        "ux_pluggy_investment_snapshots_inv_mes",
        "pluggy_investment_snapshots",
        ["investment_id", "ano_mes"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ux_pluggy_investment_snapshots_inv_mes", table_name="pluggy_investment_snapshots"
    )
    op.drop_index(
        "ix_pluggy_investment_snapshots_investment_id", table_name="pluggy_investment_snapshots"
    )
    op.drop_index(
        "ix_pluggy_investment_snapshots_user_id", table_name="pluggy_investment_snapshots"
    )
    op.drop_table("pluggy_investment_snapshots")

    op.drop_column("pluggy_investments", "investimento_sugestao_score")
    op.drop_column("pluggy_investments", "investimento_sugestao_fonte_id")
    op.drop_column("pluggy_investments", "investimento_sugestao_fonte_tipo")
    op.drop_column("pluggy_investments", "investimento_sugestao_confianca")
    op.drop_column("pluggy_investments", "investimento_sugerido_id")
