"""create planejamento_valores_eventual: override editável dos meses futuros
da linha-lembrete Eventual, por tipo (débito/crédito) — correção pós-deploy
da Sprint 38 (o pedido original do CEO tinha ficado ambíguo e virou uma
linha 100% só-leitura; o mês corrente continua só-sugestão, mas os meses
seguintes devem ser editáveis como qualquer outra linha da grade)

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-12

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

pluggy_transaction_tipo_no_create = postgresql.ENUM(
    "debito", "credito", name="pluggy_transaction_tipo", create_type=False
)


def upgrade() -> None:
    op.create_table(
        "planejamento_valores_eventual",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tipo", pluggy_transaction_tipo_no_create, nullable=False),
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
    op.create_index(
        "ix_planejamento_valores_eventual_user_id", "planejamento_valores_eventual", ["user_id"]
    )
    op.create_unique_constraint(
        "uq_planejamento_valor_eventual_user_tipo_ano_mes",
        "planejamento_valores_eventual",
        ["user_id", "tipo", "ano", "mes"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_planejamento_valor_eventual_user_tipo_ano_mes",
        "planejamento_valores_eventual",
        type_="unique",
    )
    op.drop_index(
        "ix_planejamento_valores_eventual_user_id", table_name="planejamento_valores_eventual"
    )
    op.drop_table("planejamento_valores_eventual")
