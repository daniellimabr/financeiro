from datetime import date
from decimal import Decimal

import pytest

from app.categorization import service
from app.exceptions import NotFoundError
from app.models.asset import Asset, AssetTipo
from app.models.categorization import CategorizationRule
from app.models.category import CategoryGroup, Subcategory
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_SEQ = iter(range(1, 10_000))


@pytest.fixture()
def user(db_session):
    return _user(db_session)


@pytest.fixture()
def other_user(db_session):
    return _user(db_session)


@pytest.fixture()
def subcategory(db_session):
    return _subcategory(db_session, nome="Comer fora")


@pytest.fixture()
def other_subcategory(db_session):
    return _subcategory(db_session, nome="Supermercado")


def _user(db_session, **overrides):
    n = next(_SEQ)
    defaults = {"google_sub": f"google-{n}", "email": f"user{n}@example.com", "name": "Alice"}
    defaults.update(overrides)
    u = User(**defaults)
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _subcategory(db_session, nome="Comer fora"):
    group = CategoryGroup(nome=f"Grupo {next(_SEQ)}")
    db_session.add(group)
    db_session.flush()
    s = Subcategory(group_id=group.id, nome=nome)
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


def _pending_transaction(db_session, user, descricao="Mercado Sao Joao"):
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
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{n}",
        descricao=descricao,
        valor=Decimal("-10.00"),
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 15),
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_list_pending_transactions_applies_suggestion_but_never_confirms(
    db_session, user, subcategory
):
    db_session.add(
        CategorizationRule(
            user_id=user.id,
            subcategory_id=subcategory.id,
            padrao_descricao="Mercado Sao Joao",
            padrao_normalizado="mercado sao joao",
            origem="legado",
        )
    )
    db_session.commit()
    tx = _pending_transaction(db_session, user, "Mercado Sao Joao")

    for _ in range(2):
        pending = service.list_pending_transactions(db_session, user.id)
        assert len(pending) == 1
        result = pending[0]
        assert result.id == tx.id
        assert result.subcategoria_sugerida_id == subcategory.id
        assert result.sugestao_fonte_tipo == "regra"
        assert result.subcategory_id is None
        assert result.asset_id is None
        assert result.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente


def test_list_pending_transactions_isolated_by_user_and_status(db_session, user, other_user):
    _pending_transaction(db_session, other_user, "Outra transacao")

    assert service.list_pending_transactions(db_session, user.id) == []


def test_confirm_categorization_sets_fields_and_removes_from_pending(db_session, user, subcategory):
    tx = _pending_transaction(db_session, user)

    confirmed = service.confirm_categorization(db_session, user.id, tx.id, subcategory.id)

    assert confirmed.subcategory_id == subcategory.id
    assert confirmed.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada
    assert service.list_pending_transactions(db_session, user.id) == []


def test_confirm_categorization_can_be_reedited_with_different_subcategory(
    db_session, user, subcategory, other_subcategory
):
    tx = _pending_transaction(db_session, user)
    service.confirm_categorization(db_session, user.id, tx.id, subcategory.id)

    reedited = service.confirm_categorization(db_session, user.id, tx.id, other_subcategory.id)

    assert reedited.subcategory_id == other_subcategory.id


def test_confirm_categorization_missing_transaction_raises_not_found(db_session, user, subcategory):
    with pytest.raises(NotFoundError):
        service.confirm_categorization(db_session, user.id, 999, subcategory.id)


def test_confirm_categorization_other_users_transaction_raises_not_found(
    db_session, user, other_user, subcategory
):
    tx = _pending_transaction(db_session, other_user)

    with pytest.raises(NotFoundError):
        service.confirm_categorization(db_session, user.id, tx.id, subcategory.id)


def test_confirm_categorization_invalid_subcategory_raises_not_found(db_session, user):
    tx = _pending_transaction(db_session, user)

    with pytest.raises(NotFoundError):
        service.confirm_categorization(db_session, user.id, tx.id, 999)


def test_set_transaction_asset_sets_and_clears(db_session, user):
    tx = _pending_transaction(db_session, user)
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    updated = service.set_transaction_asset(db_session, user.id, tx.id, asset.id)
    assert updated.asset_id == asset.id

    cleared = service.set_transaction_asset(db_session, user.id, tx.id, None)
    assert cleared.asset_id is None


def test_set_transaction_asset_other_users_asset_raises_not_found(db_session, user, other_user):
    tx = _pending_transaction(db_session, user)
    asset = Asset(
        user_id=other_user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    with pytest.raises(NotFoundError):
        service.set_transaction_asset(db_session, user.id, tx.id, asset.id)


def test_set_transaction_asset_missing_transaction_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.set_transaction_asset(db_session, user.id, 999, None)
