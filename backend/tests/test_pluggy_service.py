from datetime import date
from decimal import Decimal

import pytest

from app.exceptions import InvalidStateError, NotFoundError
from app.models.pluggy import PluggyAccount, PluggyTransaction
from app.models.user import User
from app.pluggy_integration import service


class FakePluggyClient:
    def __init__(self, *, item, accounts=None, transactions_by_account=None):
        self.item = item
        self.accounts = accounts or []
        self.transactions_by_account = transactions_by_account or {}
        self.get_accounts_calls = 0

    def get_item(self, pluggy_item_id):
        return self.item

    def get_accounts(self, pluggy_item_id):
        self.get_accounts_calls += 1
        return self.accounts

    def get_transactions(self, pluggy_account_id, *, from_date=None):
        return self.transactions_by_account.get(pluggy_account_id, [])

    def create_connect_token(self, *, item_id=None):
        return "connect-token"


def _item_raw(**overrides):
    data = {
        "id": "item-ext-1",
        "status": "UPDATED",
        "connector": {"id": 1, "name": "Banco Fake"},
    }
    data.update(overrides)
    return data


def _account_raw(**overrides):
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


def _transaction_raw(**overrides):
    data = {
        "id": "tx-ext-1",
        "description": "Mercado",
        "amount": -50.25,
        "type": "DEBIT",
        "date": "2026-01-15T00:00:00.000Z",
        "status": "POSTED",
        "category": "Alimentação",
    }
    data.update(overrides)
    return data


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def other_user(db_session):
    user = User(google_sub="google-2", email="b@example.com", name="Bob")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_register_item_creates_item_with_default_cutoff_date(db_session, user):
    client = FakePluggyClient(item=_item_raw())

    item = service.register_item(db_session, client, user.id, "item-ext-1")

    assert item.user_id == user.id
    assert item.connector_name == "Banco Fake"
    assert item.status.value == "updated"
    assert item.cutoff_date == date(2026, 1, 1)


def test_register_item_twice_does_not_duplicate(db_session, user):
    client = FakePluggyClient(item=_item_raw())

    first = service.register_item(db_session, client, user.id, "item-ext-1")
    second = service.register_item(db_session, client, user.id, "item-ext-1")

    assert first.id == second.id
    assert service.list_items(db_session, user.id) == [first]


def test_sync_item_creates_accounts_and_transactions(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    synced = service.sync_item(db_session, client, user.id, item.id)

    assert synced.last_synced_at is not None
    accounts = service.list_accounts(db_session, user.id)
    assert len(accounts) == 1
    assert accounts[0].user_id == user.id
    assert accounts[0].tipo.value == "corrente"

    transactions = service.list_transactions(db_session, user.id)
    assert len(transactions) == 1
    assert transactions[0].user_id == user.id
    assert transactions[0].subcategory_id is None
    assert transactions[0].data_competencia == date(2026, 1, 15)
    assert transactions[0].valor == Decimal("-50.25")


def test_sync_item_writes_data_competencia_equal_to_data_on_resync(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    service.sync_item(db_session, client, user.id, item.id)

    transactions = service.list_transactions(db_session, user.id)
    assert len(transactions) == 1
    assert transactions[0].data_competencia == transactions[0].data


def test_sync_item_twice_does_not_duplicate_accounts_or_transactions(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    service.sync_item(db_session, client, user.id, item.id)

    assert db_session.query(PluggyAccount).count() == 1
    assert db_session.query(PluggyTransaction).count() == 1


def test_sync_item_updates_transaction_status_from_pendente_to_efetivada(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw(status="PENDING")]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)
    first = service.list_transactions(db_session, user.id)[0]
    assert first.status.value == "pendente"

    client.transactions_by_account["acc-ext-1"] = [_transaction_raw(status="POSTED")]
    service.sync_item(db_session, client, user.id, item.id)

    second = service.list_transactions(db_session, user.id)[0]
    assert second.id == first.id
    assert second.status.value == "efetivada"


def test_sync_item_excludes_transactions_before_cutoff_date(db_session, user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={
            "acc-ext-1": [
                _transaction_raw(id="tx-before", date="2025-12-31T00:00:00.000Z"),
                _transaction_raw(id="tx-after", date="2026-01-15T00:00:00.000Z"),
            ]
        },
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    transactions = service.list_transactions(db_session, user.id)
    assert [t.pluggy_transaction_id for t in transactions] == ["tx-after"]


@pytest.mark.parametrize("status", ["UPDATING", "LOGIN_ERROR", "ERROR", "WAITING_USER_INPUT"])
def test_sync_item_with_non_syncable_status_raises_and_writes_nothing(db_session, user, status):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    client.item = _item_raw(status=status)

    with pytest.raises(InvalidStateError):
        service.sync_item(db_session, client, user.id, item.id)

    assert db_session.query(PluggyAccount).count() == 0
    assert db_session.query(PluggyTransaction).count() == 0
    assert client.get_accounts_calls == 0


def test_sync_item_of_other_user_raises_not_found(db_session, user, other_user):
    client = FakePluggyClient(item=_item_raw())
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    with pytest.raises(NotFoundError):
        service.sync_item(db_session, client, other_user.id, item.id)


@pytest.mark.parametrize(
    ("type_", "subtype", "expected"),
    [
        ("CREDIT", "CREDIT_CARD", "cartao_credito"),
        ("BANK", "SAVINGS_ACCOUNT", "poupanca"),
        ("BANK", "CHECKING_ACCOUNT", "corrente"),
        ("INVESTMENT", "INVESTMENT", "investimento"),
    ],
)
def test_sync_item_maps_account_tipo(db_session, user, type_, subtype, expected):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw(type=type_, subtype=subtype)],
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")

    service.sync_item(db_session, client, user.id, item.id)

    accounts = service.list_accounts(db_session, user.id)
    assert accounts[0].tipo.value == expected


def test_list_accounts_and_transactions_isolated_by_user(db_session, user, other_user):
    client = FakePluggyClient(
        item=_item_raw(),
        accounts=[_account_raw()],
        transactions_by_account={"acc-ext-1": [_transaction_raw()]},
    )
    item = service.register_item(db_session, client, user.id, "item-ext-1")
    service.sync_item(db_session, client, user.id, item.id)

    assert service.list_accounts(db_session, other_user.id) == []
    assert service.list_transactions(db_session, other_user.id) == []
    assert len(service.list_accounts(db_session, user.id)) == 1
    assert len(service.list_transactions(db_session, user.id)) == 1
