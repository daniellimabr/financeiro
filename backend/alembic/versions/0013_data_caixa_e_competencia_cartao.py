"""pluggy_transactions.data_caixa; backfill de data_competencia para
transacoes de cartao de credito (sempre evento+1, sem dia de corte) e
data_caixa para toda transacao existente

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-17

"""

from calendar import monthrange
from collections.abc import Sequence
from datetime import date

import sqlalchemy as sa
from sqlalchemy import orm

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Regra duplicada aqui (não importada de app/) porque migrations não devem
# depender de código que muda depois — mesmo precedente da migration 0012.
def _shift_to_next_month(d: date) -> date:
    year = d.year
    month = d.month + 1
    if month == 13:
        month = 1
        year += 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def _as_date(value: date | str) -> date:
    # sqlite (usado em teste) devolve string ISO em queries de texto puro;
    # postgres (produção) já devolve `date` nativo via psycopg2.
    return date.fromisoformat(value) if isinstance(value, str) else value


def _backfill(session: orm.Session) -> None:
    rows = session.execute(
        sa.text(
            """
            SELECT pt.id, pt.data, pt.data_competencia, pa.tipo
            FROM pluggy_transactions pt
            JOIN pluggy_accounts pa ON pa.id = pt.account_id
            """
        )
    ).fetchall()
    for tx_id, data_real_raw, data_competencia_atual_raw, account_tipo in rows:
        data_real = _as_date(data_real_raw)
        data_competencia_atual = (
            _as_date(data_competencia_atual_raw) if data_competencia_atual_raw else None
        )
        if account_tipo == "cartao_credito":
            nova_competencia = _shift_to_next_month(data_real)
            nova_caixa = _shift_to_next_month(nova_competencia)
        else:
            # Demais tipos de conta: competência não muda nesta sprint (regra
            # de Salário, se aplicável, já está refletida em data_competencia);
            # caixa sempre igual a competência.
            nova_competencia = data_competencia_atual if data_competencia_atual else data_real
            nova_caixa = nova_competencia
        session.execute(
            sa.text(
                "UPDATE pluggy_transactions"
                " SET data_competencia = :competencia, data_caixa = :caixa"
                " WHERE id = :id"
            ),
            {"competencia": nova_competencia, "caixa": nova_caixa, "id": tx_id},
        )


def upgrade() -> None:
    op.add_column(
        "pluggy_transactions",
        sa.Column("data_caixa", sa.Date(), nullable=True),
    )

    bind = op.get_bind()
    session = orm.Session(bind=bind)
    _backfill(session)
    session.commit()


def downgrade() -> None:
    op.drop_column("pluggy_transactions", "data_caixa")
