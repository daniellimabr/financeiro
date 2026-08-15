from datetime import date
from decimal import Decimal

import pytest

from app.assets.service import create_asset, delete_asset, sell_asset
from app.exceptions import InvalidStateError
from app.models.asset import AssetTipo
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


def test_sell_asset_marks_status_baixado(db_session, user):
    asset = create_asset(
        db_session,
        user.id,
        nome="Carro",
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )

    sold = sell_asset(
        db_session, user.id, asset.id, valor_venda=Decimal("45000.00"), data_venda=date(2026, 8, 1)
    )

    assert sold.status.value == "baixado"
    assert sold.valor_venda == Decimal("45000.00")
    assert sold.data_venda == date(2026, 8, 1)


def test_sell_asset_twice_raises_invalid_state(db_session, user):
    asset = create_asset(
        db_session,
        user.id,
        nome="Carro",
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )
    sell_asset(
        db_session, user.id, asset.id, valor_venda=Decimal("45000.00"), data_venda=date(2026, 8, 1)
    )

    with pytest.raises(InvalidStateError):
        sell_asset(
            db_session,
            user.id,
            asset.id,
            valor_venda=Decimal("40000.00"),
            data_venda=date(2026, 8, 2),
        )


def test_delete_asset_disassociates_transactions_without_deleting_them(db_session, user):
    asset = create_asset(
        db_session,
        user.id,
        nome="Carro",
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
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
        descricao="Gasolina",
        valor=Decimal("-100.00"),
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 10),
        data_competencia=date(2026, 1, 10),
        asset_id=asset.id,
        asset_sugerido_id=asset.id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)

    delete_asset(db_session, user.id, asset.id)

    db_session.refresh(tx)
    assert tx.asset_id is None
    assert tx.asset_sugerido_id is None
    assert (
        db_session.query(PluggyTransaction).filter(PluggyTransaction.id == tx.id).one_or_none()
        is not None
    )
