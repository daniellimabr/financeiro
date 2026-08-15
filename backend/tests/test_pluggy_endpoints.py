from datetime import date
from decimal import Decimal

from app.auth.jwt import COOKIE_NAME, create_access_token
from app.main import app
from app.models.asset import Asset, AssetTipo
from app.models.category import CategoryGroup, Subcategory
from app.models.liability import Liability, LiabilityTipo
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
from app.pluggy_integration.router import get_pluggy_client


class FakePluggyClient:
    def __init__(self, *, item=None, accounts=None, transactions_by_account=None):
        self.item = item or {
            "id": "item-ext-1",
            "status": "UPDATED",
            "connector": {"id": 1, "name": "Banco Fake"},
        }
        self.accounts = accounts or []
        self.transactions_by_account = transactions_by_account or {}

    def get_item(self, pluggy_item_id):
        return self.item

    def get_accounts(self, pluggy_item_id):
        return self.accounts

    def get_transactions(self, pluggy_account_id, *, from_date=None):
        return self.transactions_by_account.get(pluggy_account_id, [])

    def create_connect_token(self, *, item_id=None):
        return "connect-token-abc"


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def _use_fake_client(fake_client):
    app.dependency_overrides[get_pluggy_client] = lambda: fake_client


def teardown_function():
    app.dependency_overrides.pop(get_pluggy_client, None)


def test_connect_token_without_cookie_returns_401(client):
    response = client.post("/pluggy/connect-token", json={})
    assert response.status_code == 401


def test_connect_token_returns_token(client, db_session):
    _authenticate(client, db_session)
    _use_fake_client(FakePluggyClient())

    response = client.post("/pluggy/connect-token", json={})

    assert response.status_code == 200
    assert response.json()["access_token"] == "connect-token-abc"


def test_register_item_then_resend_does_not_duplicate(client, db_session):
    _authenticate(client, db_session)
    _use_fake_client(FakePluggyClient())

    first = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"})
    second = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"})

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]

    list_response = client.get("/pluggy/items")
    assert len(list_response.json()) == 1


def test_sync_item_creates_accounts_and_transactions(client, db_session):
    _authenticate(client, db_session)
    fake_client = FakePluggyClient(
        accounts=[
            {
                "id": "acc-ext-1",
                "type": "BANK",
                "subtype": "CHECKING_ACCOUNT",
                "name": "Conta Corrente",
                "number": "1234",
                "balance": 100.50,
                "currencyCode": "BRL",
            }
        ],
        transactions_by_account={
            "acc-ext-1": [
                {
                    "id": "tx-ext-1",
                    "description": "Mercado",
                    "amount": -50.25,
                    "type": "DEBIT",
                    "date": "2026-01-15T00:00:00.000Z",
                    "status": "POSTED",
                    "category": "Alimentação",
                }
            ]
        },
    )
    _use_fake_client(fake_client)
    item = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"}).json()

    sync_response = client.post(f"/pluggy/items/{item['id']}/sync")

    assert sync_response.status_code == 200
    assert len(client.get("/pluggy/accounts").json()) == 1
    assert len(client.get("/pluggy/transactions").json()) == 1


def test_sync_item_with_updating_status_returns_400_and_writes_nothing(client, db_session):
    _authenticate(client, db_session)
    fake_client = FakePluggyClient()
    _use_fake_client(fake_client)
    item = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"}).json()

    fake_client.item = {
        "id": "item-ext-1",
        "status": "UPDATING",
        "connector": {"id": 1, "name": "Banco Fake"},
    }

    response = client.post(f"/pluggy/items/{item['id']}/sync")

    assert response.status_code == 400
    assert client.get("/pluggy/accounts").json() == []


def test_sync_nonexistent_item_returns_404(client, db_session):
    _authenticate(client, db_session)
    _use_fake_client(FakePluggyClient())

    response = client.post("/pluggy/items/999/sync")

    assert response.status_code == 404


def test_sync_other_users_item_returns_404(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    _use_fake_client(FakePluggyClient())
    item = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"}).json()

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.post(f"/pluggy/items/{item['id']}/sync")

    assert response.status_code == 404


def test_items_accounts_transactions_without_cookie_return_401(client):
    assert client.get("/pluggy/items").status_code == 401
    assert client.get("/pluggy/accounts").status_code == 401
    assert client.get("/pluggy/transactions").status_code == 401


def test_user_does_not_see_other_users_items_accounts_transactions(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    fake_client = FakePluggyClient(
        accounts=[
            {
                "id": "acc-ext-1",
                "type": "BANK",
                "subtype": "CHECKING_ACCOUNT",
                "name": "Conta Corrente",
                "number": "1234",
                "balance": 100.50,
                "currencyCode": "BRL",
            }
        ],
        transactions_by_account={
            "acc-ext-1": [
                {
                    "id": "tx-ext-1",
                    "description": "Mercado",
                    "amount": -50.25,
                    "type": "DEBIT",
                    "date": "2026-01-15T00:00:00.000Z",
                    "status": "POSTED",
                    "category": "Alimentação",
                }
            ]
        },
    )
    _use_fake_client(fake_client)
    item = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"}).json()
    client.post(f"/pluggy/items/{item['id']}/sync")

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    assert client.get("/pluggy/items").json() == []
    assert client.get("/pluggy/accounts").json() == []
    assert client.get("/pluggy/transactions").json() == []


def _subcategory(db_session, nome="Mercado"):
    group = CategoryGroup(nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome=nome)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def _asset(db_session, user, nome="Carro"):
    asset = Asset(
        user_id=user.id,
        nome=nome,
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset


def _liability(db_session, user, nome="Financiamento"):
    liability = Liability(
        user_id=user.id,
        nome=nome,
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)
    return liability


def _transaction(
    db_session,
    user,
    *,
    account_tipo=PluggyAccountTipo.corrente,
    valor="-10.00",
    tipo=PluggyTransactionTipo.debito,
    data=date(2026, 1, 15),
    data_competencia=None,
    subcategory_id=None,
    asset_id=None,
    liability_id=None,
):
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{user.id}-{valor}-{data}-{account_tipo}",
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
        pluggy_account_id=f"acc-{user.id}-{valor}-{data}-{account_tipo}",
        tipo=account_tipo,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{user.id}-{valor}-{data}-{account_tipo}",
        descricao="Transacao",
        valor=Decimal(valor),
        tipo=tipo,
        data=data,
        data_competencia=data_competencia if data_competencia is not None else data,
        subcategory_id=subcategory_id,
        asset_id=asset_id,
        liability_id=liability_id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_list_transactions_without_filters_returns_everything(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(db_session, user, valor="-10.00", data=date(2026, 1, 15))
    _transaction(db_session, user, valor="-20.00", data=date(2026, 2, 1))

    response = client.get("/pluggy/transactions")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_list_transactions_filters_by_ano_and_mes(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(db_session, user, valor="-10.00", data=date(2026, 1, 31))
    _transaction(db_session, user, valor="-20.00", data=date(2026, 2, 1))

    response = client.get("/pluggy/transactions", params={"ano": 2026, "mes": 1})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_subcategory_id(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session)
    _transaction(db_session, user, valor="-10.00", subcategory_id=sub.id)
    _transaction(db_session, user, valor="-20.00", subcategory_id=None)

    response = client.get("/pluggy/transactions", params={"subcategory_id": sub.id})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_subcategory_id_zero_returns_uncategorized(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session)
    _transaction(db_session, user, valor="-10.00", subcategory_id=sub.id)
    _transaction(db_session, user, valor="-20.00", subcategory_id=None)

    response = client.get("/pluggy/transactions", params={"subcategory_id": 0})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-20.00")


def test_list_transactions_filters_by_account_tipo(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(db_session, user, valor="-10.00", account_tipo=PluggyAccountTipo.corrente)
    _transaction(db_session, user, valor="120.00", account_tipo=PluggyAccountTipo.cartao_credito)

    response = client.get("/pluggy/transactions", params={"account_tipo": "cartao_credito"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("120.00")


def test_list_transactions_filters_by_competencia_flag(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(
        db_session,
        user,
        valor="-10.00",
        data=date(2026, 1, 31),
        data_competencia=date(2026, 2, 1),
    )

    by_data = client.get("/pluggy/transactions", params={"ano": 2026, "mes": 1}).json()
    by_competencia = client.get(
        "/pluggy/transactions", params={"ano": 2026, "mes": 1, "competencia": True}
    ).json()
    by_competencia_february = client.get(
        "/pluggy/transactions", params={"ano": 2026, "mes": 2, "competencia": True}
    ).json()

    assert len(by_data) == 1
    assert len(by_competencia) == 0
    assert len(by_competencia_february) == 1


def test_list_transactions_combined_filters_isolated_by_user(client, db_session):
    user = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    sub = _subcategory(db_session)
    _transaction(
        db_session,
        user,
        valor="-10.00",
        data=date(2026, 1, 15),
        subcategory_id=sub.id,
        account_tipo=PluggyAccountTipo.corrente,
    )

    other = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _transaction(
        db_session,
        other,
        valor="-999.00",
        data=date(2026, 1, 15),
        subcategory_id=sub.id,
        account_tipo=PluggyAccountTipo.corrente,
    )

    response = client.get(
        "/pluggy/transactions",
        params={
            "ano": 2026,
            "mes": 1,
            "subcategory_id": sub.id,
            "account_tipo": "corrente",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_tipo_combined_with_asset_id(client, db_session):
    user = _authenticate(client, db_session)
    asset = _asset(db_session, user)
    _transaction(
        db_session,
        user,
        valor="-10.00",
        tipo=PluggyTransactionTipo.debito,
        asset_id=asset.id,
    )
    _transaction(
        db_session,
        user,
        valor="500.00",
        tipo=PluggyTransactionTipo.credito,
        asset_id=asset.id,
    )

    despesas = client.get(
        "/pluggy/transactions", params={"asset_id": asset.id, "tipo": "debito"}
    ).json()
    receitas = client.get(
        "/pluggy/transactions", params={"asset_id": asset.id, "tipo": "credito"}
    ).json()

    assert len(despesas) == 1
    assert Decimal(despesas[0]["valor"]) == Decimal("-10.00")
    assert len(receitas) == 1
    assert Decimal(receitas[0]["valor"]) == Decimal("500.00")


def test_list_transactions_filters_by_asset_id(client, db_session):
    user = _authenticate(client, db_session)
    asset = _asset(db_session, user)
    _transaction(db_session, user, valor="-10.00", asset_id=asset.id)
    _transaction(db_session, user, valor="-20.00", asset_id=None)

    response = client.get("/pluggy/transactions", params={"asset_id": asset.id})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_asset_id_combined_with_ano_mes_subcategoria(
    client, db_session
):
    user = _authenticate(client, db_session)
    asset = _asset(db_session, user)
    sub = _subcategory(db_session)
    _transaction(
        db_session,
        user,
        valor="-10.00",
        data=date(2026, 1, 15),
        subcategory_id=sub.id,
        asset_id=asset.id,
    )
    _transaction(
        db_session,
        user,
        valor="-20.00",
        data=date(2026, 2, 15),
        subcategory_id=sub.id,
        asset_id=asset.id,
    )
    _transaction(
        db_session, user, valor="-30.00", data=date(2026, 1, 15), subcategory_id=None, asset_id=None
    )

    response = client.get(
        "/pluggy/transactions",
        params={"ano": 2026, "mes": 1, "subcategory_id": sub.id, "asset_id": asset.id},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_asset_id_isolated_by_user(client, db_session):
    user = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    asset = _asset(db_session, user)
    _transaction(db_session, user, valor="-10.00", asset_id=asset.id)

    other = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_asset = _asset(db_session, other, nome="Moto")
    _transaction(db_session, other, valor="-999.00", asset_id=other_asset.id)

    response = client.get("/pluggy/transactions", params={"asset_id": asset.id})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_liability_id(client, db_session):
    user = _authenticate(client, db_session)
    liability = _liability(db_session, user)
    _transaction(db_session, user, valor="-10.00", liability_id=liability.id)
    _transaction(db_session, user, valor="-20.00", liability_id=None)

    response = client.get("/pluggy/transactions", params={"liability_id": liability.id})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_filters_by_liability_id_isolated_by_user(client, db_session):
    user = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    liability = _liability(db_session, user)
    _transaction(db_session, user, valor="-10.00", liability_id=liability.id)

    other = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    other_liability = _liability(db_session, other, nome="Outro financiamento")
    _transaction(db_session, other, valor="-999.00", liability_id=other_liability.id)

    response = client.get("/pluggy/transactions", params={"liability_id": liability.id})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["valor"]) == Decimal("-10.00")


def test_list_transactions_response_includes_account_tipo(client, db_session):
    user = _authenticate(client, db_session)
    _transaction(db_session, user, valor="-10.00", account_tipo=PluggyAccountTipo.cartao_credito)

    response = client.get("/pluggy/transactions")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["account_tipo"] == "cartao_credito"


# --- PUT /pluggy/accounts/{id} e POST /pluggy/sync (Sprint 7) --------------


def _account_raw_payload(**overrides):
    data = {
        "id": "acc-ext-1",
        "type": "BANK",
        "subtype": "CHECKING_ACCOUNT",
        "name": "Conta Corrente",
        "number": "1234",
        "balance": 100.50,
        "currencyCode": "BRL",
    }
    data.update(overrides)
    return data


def _connect_account(client, db_session):
    fake_client = FakePluggyClient(
        accounts=[_account_raw_payload()],
        transactions_by_account={"acc-ext-1": []},
    )
    _use_fake_client(fake_client)
    item = client.post("/pluggy/items", json={"pluggy_item_id": "item-ext-1"}).json()
    client.post(f"/pluggy/items/{item['id']}/sync")
    account = client.get("/pluggy/accounts").json()[0]
    return item, account, fake_client


def test_update_account_without_cookie_returns_401(client):
    response = client.put("/pluggy/accounts/1", json={"apelido": "X", "sync_enabled": True})
    assert response.status_code == 401


def test_sync_without_cookie_returns_401(client):
    response = client.post("/pluggy/sync", json={})
    assert response.status_code == 401


def test_update_account_sets_apelido_and_sync_enabled(client, db_session):
    _authenticate(client, db_session)
    _, account, _fake_client = _connect_account(client, db_session)

    response = client.put(
        f"/pluggy/accounts/{account['id']}",
        json={"apelido": "Conta principal", "sync_enabled": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["apelido"] == "Conta principal"
    assert body["sync_enabled"] is False


def test_update_other_users_account_returns_404(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    _, account, _fake_client = _connect_account(client, db_session)

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.put(
        f"/pluggy/accounts/{account['id']}", json={"apelido": "X", "sync_enabled": True}
    )

    assert response.status_code == 404


def test_sync_endpoint_syncs_all_items_when_no_filter(client, db_session):
    _authenticate(client, db_session)
    item, _account, fake_client = _connect_account(client, db_session)
    del fake_client

    response = client.post("/pluggy/sync", json={})

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["item_id"] == item["id"]
    assert results[0]["success"] is True


def test_sync_endpoint_respects_sync_enabled_false_on_account(client, db_session):
    _authenticate(client, db_session)
    _item, account, fake_client = _connect_account(client, db_session)
    client.put(f"/pluggy/accounts/{account['id']}", json={"apelido": None, "sync_enabled": False})
    fake_client.accounts = [_account_raw_payload(balance=999.99)]

    response = client.post("/pluggy/sync", json={})

    assert response.status_code == 200
    reloaded = client.get("/pluggy/accounts").json()[0]
    assert Decimal(reloaded["saldo"]) == Decimal("100.50")


def test_sync_endpoint_reports_failure_for_invalid_item_without_blocking_others(client, db_session):
    _authenticate(client, db_session)
    item, _account, _fake_client = _connect_account(client, db_session)

    response = client.post("/pluggy/sync", json={"item_ids": [item["id"], 999]})

    results = {r["item_id"]: r for r in response.json()["results"]}
    assert results[item["id"]]["success"] is True
    assert results[999]["success"] is False
