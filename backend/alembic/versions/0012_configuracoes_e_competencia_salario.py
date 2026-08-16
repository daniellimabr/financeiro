"""configuracoes: cutoff de competencia de salario em users, saldo_inicial em
pluggy_accounts, backfill de data_competencia para transacoes ja
categorizadas como Salario

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-16

"""

from calendar import monthrange
from collections.abc import Sequence
from datetime import date

import sqlalchemy as sa
from sqlalchemy import orm

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CUTOFF_PADRAO = 25


# Regra duplicada aqui (não importada de app/) porque migrations não devem
# depender de código que muda depois — mesmo precedente da migration 0008
# (lookup de subcategoria por nome direto em SQL).
def _shift_to_next_month(d: date) -> date:
    year = d.year
    month = d.month + 1
    if month == 13:
        month = 1
        year += 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def _competencia_salario(d: date, cutoff_dia: int) -> date:
    if d.day >= cutoff_dia:
        return _shift_to_next_month(d)
    return d


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "salario_competencia_cutoff_dia",
            sa.Integer(),
            nullable=False,
            server_default=str(_CUTOFF_PADRAO),
        ),
    )
    op.add_column(
        "pluggy_accounts",
        sa.Column("saldo_inicial", sa.Numeric(14, 2), nullable=True),
    )

    bind = op.get_bind()
    session = orm.Session(bind=bind)
    rows = session.execute(
        sa.text(
            """
            SELECT pt.id, pt.data
            FROM pluggy_transactions pt
            JOIN subcategories sc ON sc.id = pt.subcategory_id
            JOIN category_groups cg ON cg.id = sc.group_id
            WHERE sc.nome = 'Salário' AND cg.nome = 'Receitas'
            """
        )
    ).fetchall()
    for tx_id, data_real in rows:
        nova_competencia = _competencia_salario(data_real, _CUTOFF_PADRAO)
        session.execute(
            sa.text("UPDATE pluggy_transactions SET data_competencia = :nova WHERE id = :id"),
            {"nova": nova_competencia, "id": tx_id},
        )
    session.commit()


def downgrade() -> None:
    op.drop_column("pluggy_accounts", "saldo_inicial")
    op.drop_column("users", "salario_competencia_cutoff_dia")
