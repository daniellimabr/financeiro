"""create orcamentos table: orcamento por subcategoria/usuario, tipo
eventual (ano/mes exatos) ou recorrente (data_inicio + data_fim opcional)

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

orcamento_tipo_enum = postgresql.ENUM("eventual", "recorrente", name="orcamento_tipo")
orcamento_tipo_enum_no_create = postgresql.ENUM(
    "eventual", "recorrente", name="orcamento_tipo", create_type=False
)


def upgrade() -> None:
    orcamento_tipo_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "orcamentos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "subcategory_id", sa.Integer(), sa.ForeignKey("subcategories.id"), nullable=False
        ),
        sa.Column("tipo", orcamento_tipo_enum_no_create, nullable=False),
        sa.Column("valor", sa.Numeric(14, 2), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=True),
        sa.Column("mes", sa.Integer(), nullable=True),
        sa.Column("data_inicio", sa.Date(), nullable=True),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_orcamentos_user_id", "orcamentos", ["user_id"])
    op.create_index("ix_orcamentos_subcategory_id", "orcamentos", ["subcategory_id"])
    op.create_index("ix_orcamentos_tipo_ano_mes", "orcamentos", ["tipo", "ano", "mes"])


def downgrade() -> None:
    op.drop_index("ix_orcamentos_tipo_ano_mes", table_name="orcamentos")
    op.drop_index("ix_orcamentos_subcategory_id", table_name="orcamentos")
    op.drop_index("ix_orcamentos_user_id", table_name="orcamentos")
    op.drop_table("orcamentos")

    orcamento_tipo_enum.drop(op.get_bind(), checkfirst=True)
