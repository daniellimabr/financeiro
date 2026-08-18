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


INVESTIMENTO_PAYLOAD = {"nome": "Reserva de emergência"}


def test_list_investimentos_without_cookie_returns_401(client):
    response = client.get("/investimentos")
    assert response.status_code == 401


def test_create_and_list_investimento(client, db_session):
    _authenticate(client, db_session)

    create_response = client.post("/investimentos", json=INVESTIMENTO_PAYLOAD)
    assert create_response.status_code == 201

    list_response = client.get("/investimentos")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["valor_atual"] == "0"


def test_user_does_not_see_other_users_investimentos(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    client.post("/investimentos", json=INVESTIMENTO_PAYLOAD)

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.get("/investimentos")

    assert response.status_code == 200
    assert response.json() == []


def test_update_investimento(client, db_session):
    _authenticate(client, db_session)
    investimento = client.post("/investimentos", json=INVESTIMENTO_PAYLOAD).json()

    response = client.put(
        f"/investimentos/{investimento['id']}", json={"nome": "Reserva atualizada"}
    )

    assert response.status_code == 200
    assert response.json()["nome"] == "Reserva atualizada"


def test_update_missing_investimento_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.put("/investimentos/999", json=INVESTIMENTO_PAYLOAD)

    assert response.status_code == 404


def test_delete_investimento(client, db_session):
    _authenticate(client, db_session)
    investimento = client.post("/investimentos", json=INVESTIMENTO_PAYLOAD).json()

    delete_response = client.delete(f"/investimentos/{investimento['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/investimentos/{investimento['id']}")
    assert get_response.status_code == 404


def test_delete_missing_investimento_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.delete("/investimentos/999")

    assert response.status_code == 404


def test_get_other_users_investimento_returns_404(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    investimento = client.post("/investimentos", json=INVESTIMENTO_PAYLOAD).json()

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.get(f"/investimentos/{investimento['id']}")

    assert response.status_code == 404


def test_get_evolucao_returns_zeroed_fields_without_carteiras(client, db_session):
    _authenticate(client, db_session)
    investimento = client.post("/investimentos", json=INVESTIMENTO_PAYLOAD).json()

    response = client.get(f"/investimentos/{investimento['id']}/evolucao")

    assert response.status_code == 200
    body = response.json()
    assert body["saldo_base"] == "0.00"
    assert body["saldo_atual"] == "0.00"
    # Sem grupo/subcategoria "Investimentos" seedado nesta base de teste
    # (sqlite via Base.metadata.create_all, não pela migration 0015), os
    # totais de aporte/resgate caem no early-return literal (sem carteiras
    # vinculadas o resultado é o mesmo de qualquer forma: zero).
    assert body["total_aportes"] == "0"
    assert body["total_resgates"] == "0"
    assert body["rendimento_estimado"] == "0.00"


def test_get_evolucao_missing_investimento_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.get("/investimentos/999/evolucao")

    assert response.status_code == 404


def test_evolucao_mensal_without_cookie_returns_401(client):
    response = client.get("/investimentos/1/evolucao-mensal")
    assert response.status_code == 401


def test_get_evolucao_mensal_empty_when_no_holdings(client, db_session):
    _authenticate(client, db_session)
    investimento = client.post("/investimentos", json=INVESTIMENTO_PAYLOAD).json()

    response = client.get(f"/investimentos/{investimento['id']}/evolucao-mensal")

    assert response.status_code == 200
    assert response.json() == []


def test_get_evolucao_mensal_missing_investimento_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.get("/investimentos/999/evolucao-mensal")

    assert response.status_code == 404
