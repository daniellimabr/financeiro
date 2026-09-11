"""create planejamento_valores e itens_planejados: Mesa de Planejamento
(Sprint 38, PRD-038) — valores confirmados por subcategoria/mês e itens
planejados livres, com vínculo opcional a uma transação real

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

pluggy_transaction_tipo_no_create = postgresql.ENUM(
    "debito", "credito", name="pluggy_transaction_tipo", create_type=False
)


def upgrade() -> None:
    op.create_table(
        "planejamento_valores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "subcategory_id", sa.Integer(), sa.ForeignKey("subcategories.id"), nullable=False
        ),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("mes", sa.Integer(), nullable=False),
        sa.Column("valor", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_planejamento_valores_user_id", "planejamento_valores", ["user_id"])
    op.create_index(
        "ix_planejamento_valores_subcategory_id", "planejamento_valores", ["subcategory_id"]
    )
    op.create_unique_constraint(
        "uq_planejamento_valor_user_sub_ano_mes",
        "planejamento_valores",
        ["user_id", "subcategory_id", "ano", "mes"],
    )

    op.create_table(
        "itens_planejados",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("tipo", pluggy_transaction_tipo_no_create, nullable=False),
        sa.Column("valor", sa.Numeric(14, 2), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("recorrente", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column(
            "transacao_vinculada_id",
            sa.Integer(),
            sa.ForeignKey("pluggy_transactions.id"),
            nullable=True,
            unique=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_itens_planejados_user_id", "itens_planejados", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_itens_planejados_user_id", table_name="itens_planejados")
    op.drop_table("itens_planejados")

    op.drop_constraint(
        "uq_planejamento_valor_user_sub_ano_mes", "planejamento_valores", type_="unique"
    )
    op.drop_index("ix_planejamento_valores_subcategory_id", table_name="planejamento_valores")
    op.drop_index("ix_planejamento_valores_user_id", table_name="planejamento_valores")
    op.drop_table("planejamento_valores")
