from datetime import date
from decimal import Decimal

from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.asset import Asset, AssetTipo
from app.models.category import CategoryGroup, Subcategory
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


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def _subcategory(db_session, nome="Comer fora"):
    group = CategoryGroup(nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome=nome)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def _pending_transaction(db_session, user, descricao="Mercado Sao Joao"):
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{user.id}-{descricao}",
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
        pluggy_account_id=f"acc-{user.id}-{descricao}",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{user.id}-{descricao}",
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


def test_list_pending_without_cookie_returns_401(client):
    response = client.get("/categorization/pending")
    assert response.status_code == 401


def test_confirm_without_cookie_returns_401(client):
    response = client.post("/categorization/pending/1/confirm", json={"subcategory_id": 1})
    assert response.status_code == 401


def test_set_asset_without_cookie_returns_401(client):
    response = client.put("/categorization/pending/1/asset", json={"asset_id": None})
    assert response.status_code == 401


def test_list_pending_returns_transaction_with_suggestion_and_never_confirms(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session)
    tx = _pending_transaction(db_session, user)

    response = client.get("/categorization/pending")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == tx.id
    assert body[0]["subcategory_id"] is None
    assert body[0]["categorizacao_status"] == "pendente"
    del subcategory


def test_user_a_does_not_see_or_confirm_user_bs_transactions(client, db_session):
    user_a = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    tx_b_owner = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(tx_b_owner)
    db_session.commit()
    db_session.refresh(tx_b_owner)
    tx_b = _pending_transaction(db_session, tx_b_owner)
    subcategory = _subcategory(db_session)
    del user_a

    list_response = client.get("/categorization/pending")
    assert list_response.json() == []

    confirm_response = client.post(
        f"/categorization/pending/{tx_b.id}/confirm",
        json={"subcategory_id": subcategory.id},
    )
    assert confirm_response.status_code == 404

    asset_response = client.put(f"/categorization/pending/{tx_b.id}/asset", json={"asset_id": None})
    assert asset_response.status_code == 404


def test_confirm_categorization_removes_from_pending_and_reedit_works(client, db_session):
    user = _authenticate(client, db_session)
    subcategory = _subcategory(db_session, nome="Comer fora")
    other_subcategory = _subcategory(db_session, nome="Supermercado")
    tx = _pending_transaction(db_session, user)

    confirm_response = client.post(
        f"/categorization/pending/{tx.id}/confirm", json={"subcategory_id": subcategory.id}
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["subcategory_id"] == subcategory.id
    assert confirm_response.json()["categorizacao_status"] == "confirmada"

    assert client.get("/categorization/pending").json() == []

    reedit_response = client.post(
        f"/categorization/pending/{tx.id}/confirm", json={"subcategory_id": other_subcategory.id}
    )
    assert reedit_response.status_code == 200
    assert reedit_response.json()["subcategory_id"] == other_subcategory.id


def test_confirm_categorization_with_invalid_subcategory_returns_404(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)

    response = client.post(f"/categorization/pending/{tx.id}/confirm", json={"subcategory_id": 999})

    assert response.status_code == 404


def test_set_and_clear_asset_association(client, db_session):
    user = _authenticate(client, db_session)
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

    set_response = client.put(f"/categorization/pending/{tx.id}/asset", json={"asset_id": asset.id})
    assert set_response.status_code == 200
    assert set_response.json()["asset_id"] == asset.id

    clear_response = client.put(f"/categorization/pending/{tx.id}/asset", json={"asset_id": None})
    assert clear_response.status_code == 200
    assert clear_response.json()["asset_id"] is None


def test_set_asset_with_invalid_asset_id_returns_404(client, db_session):
    user = _authenticate(client, db_session)
    tx = _pending_transaction(db_session, user)

    response = client.put(f"/categorization/pending/{tx.id}/asset", json={"asset_id": 999})

    assert response.status_code == 404
