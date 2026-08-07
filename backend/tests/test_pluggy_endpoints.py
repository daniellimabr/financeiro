from app.auth.jwt import COOKIE_NAME, create_access_token
from app.main import app
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
