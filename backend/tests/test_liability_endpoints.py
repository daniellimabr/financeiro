from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.user import User


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


LIABILITY_PAYLOAD = {
    "nome": "Financiamento carro",
    "tipo": "financiamento",
    "valor_total": "60000.00",
    "saldo_devedor": "30000.00",
}


def test_list_liabilities_without_cookie_returns_401(client):
    response = client.get("/liabilities")
    assert response.status_code == 401


def test_create_and_list_liability(client, db_session):
    _authenticate(client, db_session)

    create_response = client.post("/liabilities", json=LIABILITY_PAYLOAD)
    assert create_response.status_code == 201

    list_response = client.get("/liabilities")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_user_does_not_see_other_users_liabilities(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    client.post("/liabilities", json=LIABILITY_PAYLOAD)

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.get("/liabilities")

    assert response.status_code == 200
    assert response.json() == []


def test_settle_liability_then_second_settle_fails(client, db_session):
    _authenticate(client, db_session)
    liability = client.post("/liabilities", json=LIABILITY_PAYLOAD).json()

    settle_response = client.post(f"/liabilities/{liability['id']}/settle")
    assert settle_response.status_code == 200
    assert settle_response.json()["status"] == "quitado"

    second_settle_response = client.post(f"/liabilities/{liability['id']}/settle")
    assert second_settle_response.status_code == 400


def test_get_update_delete_liability(client, db_session):
    _authenticate(client, db_session)
    liability = client.post("/liabilities", json=LIABILITY_PAYLOAD).json()

    get_response = client.get(f"/liabilities/{liability['id']}")
    assert get_response.status_code == 200

    update_response = client.put(
        f"/liabilities/{liability['id']}",
        json={**LIABILITY_PAYLOAD, "nome": "Financiamento atualizado"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["nome"] == "Financiamento atualizado"

    delete_response = client.delete(f"/liabilities/{liability['id']}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/liabilities/{liability['id']}")
    assert missing_response.status_code == 404


def test_update_missing_liability_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.put("/liabilities/999", json=LIABILITY_PAYLOAD)

    assert response.status_code == 404


def test_delete_missing_liability_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.delete("/liabilities/999")

    assert response.status_code == 404


def test_settle_missing_liability_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.post("/liabilities/999/settle")

    assert response.status_code == 404
