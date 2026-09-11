"""drop orcamentos table e enum orcamento_tipo — mecanismo de Orçamento
(Sprint 30) eliminado por completo, sem uso real segundo o CEO (Sprint 38,
PRD-038); substituído pela Mesa de Planejamento

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

orcamento_tipo_enum = postgresql.ENUM("eventual", "recorrente", name="orcamento_tipo")
orcamento_tipo_enum_no_create = postgresql.ENUM(
    "eventual", "recorrente", name="orcamento_tipo", create_type=False
)


def upgrade() -> None:
    op.drop_index("ix_orcamentos_tipo_ano_mes", table_name="orcamentos")
    op.drop_index("ix_orcamentos_subcategory_id", table_name="orcamentos")
    op.drop_index("ix_orcamentos_user_id", table_name="orcamentos")
    op.drop_table("orcamentos")

    orcamento_tipo_enum.drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # Downgrade recria o schema vazio — sem dado a restaurar (confirmado pelo
    # CEO como não utilizado; ver PRD-038).
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
