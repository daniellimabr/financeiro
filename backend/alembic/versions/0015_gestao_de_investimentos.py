"""gestao de investimentos: tabelas investimentos e
investimento_categorization_rules; colunas investimento_id em
pluggy_accounts/pluggy_transactions; seed grupo "Investimentos" +
subcategorias Aporte/Resgate

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-17

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "investimentos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_investimentos_user_id", "investimentos", ["user_id"])

    op.create_table(
        "investimento_categorization_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "investimento_id", sa.Integer(), sa.ForeignKey("investimentos.id"), nullable=False
        ),
        sa.Column("padrao_descricao", sa.String(length=500), nullable=False),
        sa.Column("padrao_normalizado", sa.String(length=500), nullable=False),
        sa.Column("origem", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_investimento_categorization_rules_user_id",
        "investimento_categorization_rules",
        ["user_id"],
    )
    op.create_index(
        "uq_investimento_categorization_rule_user_padrao",
        "investimento_categorization_rules",
        ["user_id", "padrao_normalizado"],
        unique=True,
    )

    op.add_column(
        "pluggy_accounts",
        sa.Column(
            "investimento_id", sa.Integer(), sa.ForeignKey("investimentos.id"), nullable=True
        ),
    )

    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "investimento_id", sa.Integer(), sa.ForeignKey("investimentos.id"), nullable=True
        ),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column(
            "investimento_sugerido_id",
            sa.Integer(),
            sa.ForeignKey("investimentos.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "pluggy_transactions",
        sa.Column("investimento_sugestao_confianca", sa.String(length=20), nullable=True),
    )

    op.execute(
        """
        INSERT INTO category_groups (nome, excluir_de_totais, created_at, updated_at)
        VALUES ('Investimentos', false, now(), now())
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO subcategories (group_id, nome, created_at, updated_at)
        SELECT id, 'Aporte', now(), now()
        FROM category_groups
        WHERE nome = 'Investimentos'
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO subcategories (group_id, nome, created_at, updated_at)
        SELECT id, 'Resgate', now(), now()
        FROM category_groups
        WHERE nome = 'Investimentos'
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM subcategories
        WHERE nome IN ('Aporte', 'Resgate')
          AND group_id = (SELECT id FROM category_groups WHERE nome = 'Investimentos')
        """
    )
    op.execute("DELETE FROM category_groups WHERE nome = 'Investimentos'")

    op.drop_column("pluggy_transactions", "investimento_sugestao_confianca")
    op.drop_column("pluggy_transactions", "investimento_sugerido_id")
    op.drop_column("pluggy_transactions", "investimento_id")

    op.drop_column("pluggy_accounts", "investimento_id")

    op.drop_index(
        "uq_investimento_categorization_rule_user_padrao",
        table_name="investimento_categorization_rules",
    )
    op.drop_index(
        "ix_investimento_categorization_rules_user_id",
        table_name="investimento_categorization_rules",
    )
    op.drop_table("investimento_categorization_rules")

    op.drop_index("ix_investimentos_user_id", table_name="investimentos")
    op.drop_table("investimentos")
