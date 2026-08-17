import importlib.util
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_SEQ = iter(range(1, 10_000))

_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0013_data_caixa_e_competencia_cartao.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0013", _MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def migration():
    return _load_migration()


@pytest.fixture()
def user(db_session):
    n = next(_SEQ)
    u = User(google_sub=f"google-{n}", email=f"user{n}@example.com", name="Alice")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _account(db_session, user, tipo):
    n = next(_SEQ)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{n}",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    account = PluggyAccount(
        item_id=item.id,
        user_id=user.id,
        pluggy_account_id=f"acc-{n}",
        tipo=tipo,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    return account


def _transaction(db_session, user, account, *, data, data_competencia):
    n = next(_SEQ)
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{n}",
        descricao="Transacao",
        valor=Decimal("-10.00"),
        tipo=PluggyTransactionTipo.debito,
        data=data,
        data_competencia=data_competencia,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_backfill_shifts_competencia_and_sets_caixa_for_credit_card(db_session, user, migration):
    account = _account(db_session, user, PluggyAccountTipo.cartao_credito)
    tx = _transaction(
        db_session, user, account, data=date(2026, 1, 15), data_competencia=date(2026, 1, 15)
    )

    migration._backfill(db_session)
    db_session.commit()
    db_session.refresh(tx)

    assert tx.data_competencia == date(2026, 2, 15)
    assert tx.data_caixa == date(2026, 3, 15)


def test_backfill_keeps_existing_competencia_and_mirrors_caixa_for_non_credit_card(
    db_session, user, migration
):
    account = _account(db_session, user, PluggyAccountTipo.corrente)
    # data_competencia já deslocada por regra de Salário — backfill não mexe.
    tx = _transaction(
        db_session, user, account, data=date(2026, 1, 28), data_competencia=date(2026, 2, 25)
    )

    migration._backfill(db_session)
    db_session.commit()
    db_session.refresh(tx)

    assert tx.data_competencia == date(2026, 2, 25)
    assert tx.data_caixa == date(2026, 2, 25)


def test_backfill_falls_back_to_data_when_competencia_missing(db_session, user, migration):
    account = _account(db_session, user, PluggyAccountTipo.corrente)
    tx = _transaction(db_session, user, account, data=date(2026, 1, 10), data_competencia=None)

    migration._backfill(db_session)
    db_session.commit()
    db_session.refresh(tx)

    assert tx.data_competencia == date(2026, 1, 10)
    assert tx.data_caixa == date(2026, 1, 10)


def test_backfill_credit_card_clamps_day_overflow_across_two_months(db_session, user, migration):
    account = _account(db_session, user, PluggyAccountTipo.cartao_credito)
    tx = _transaction(
        db_session, user, account, data=date(2026, 1, 31), data_competencia=date(2026, 1, 31)
    )

    migration._backfill(db_session)
    db_session.commit()
    db_session.refresh(tx)

    assert tx.data_competencia == date(2026, 2, 28)
    assert tx.data_caixa == date(2026, 3, 28)


def test_backfill_is_isolated_per_transaction_not_user(db_session, migration):
    other = User(google_sub="google-other-mig", email="other-mig@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account_a = _account(db_session, other, PluggyAccountTipo.cartao_credito)
    tx_a = _transaction(
        db_session, other, account_a, data=date(2026, 3, 1), data_competencia=date(2026, 3, 1)
    )

    migration._backfill(db_session)
    db_session.commit()
    db_session.refresh(tx_a)

    assert tx_a.data_competencia == date(2026, 4, 1)
