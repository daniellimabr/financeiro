from datetime import date
from decimal import Decimal

import pytest

from app.exceptions import InvalidStateError
from app.liabilities.service import create_liability, delete_liability, settle_liability
from app.models.liability import LiabilityTipo
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


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_settle_liability_marks_status_quitado(db_session, user):
    liability = create_liability(
        db_session,
        user.id,
        nome="Financiamento carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )

    settled = settle_liability(db_session, user.id, liability.id)

    assert settled.status.value == "quitado"
    assert settled.data_quitacao is not None


def test_settle_liability_twice_raises_invalid_state(db_session, user):
    liability = create_liability(
        db_session,
        user.id,
        nome="Financiamento carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    settle_liability(db_session, user.id, liability.id)

    with pytest.raises(InvalidStateError):
        settle_liability(db_session, user.id, liability.id)


def test_delete_liability_disassociates_transactions_without_deleting_them(db_session, user):
    liability = create_liability(
        db_session,
        user.id,
        nome="Financiamento carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id="item-1",
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
        pluggy_account_id="acc-1",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id="tx-1",
        descricao="Parcela financiamento",
        valor=Decimal("-500.00"),
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        data_competencia=date(2026, 1, 10),
        liability_id=liability.id,
        liability_sugerido_id=liability.id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)

    delete_liability(db_session, user.id, liability.id)

    db_session.refresh(tx)
    assert tx.liability_id is None
    assert tx.liability_sugerido_id is None
    assert (
        db_session.query(PluggyTransaction).filter(PluggyTransaction.id == tx.id).one_or_none()
        is not None
    )
