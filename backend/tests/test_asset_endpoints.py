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


ASSET_PAYLOAD = {
    "nome": "Carro",
    "tipo": "veiculo",
    "valor_atual": "50000.00",
    "data_aquisicao": "2024-01-01",
}


def test_list_assets_without_cookie_returns_401(client):
    response = client.get("/assets")
    assert response.status_code == 401


def test_create_and_list_asset(client, db_session):
    _authenticate(client, db_session)

    create_response = client.post("/assets", json=ASSET_PAYLOAD)
    assert create_response.status_code == 201

    list_response = client.get("/assets")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_user_does_not_see_other_users_assets(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    client.post("/assets", json=ASSET_PAYLOAD)

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.get("/assets")

    assert response.status_code == 200
    assert response.json() == []


def test_sell_asset_then_second_sell_fails(client, db_session):
    _authenticate(client, db_session)
    asset = client.post("/assets", json=ASSET_PAYLOAD).json()

    sell_response = client.post(
        f"/assets/{asset['id']}/sell",
        json={"valor_venda": "45000.00", "data_venda": "2026-08-01"},
    )
    assert sell_response.status_code == 200
    assert sell_response.json()["status"] == "baixado"

    second_sell_response = client.post(
        f"/assets/{asset['id']}/sell",
        json={"valor_venda": "40000.00", "data_venda": "2026-08-02"},
    )
    assert second_sell_response.status_code == 400


def test_update_asset(client, db_session):
    _authenticate(client, db_session)
    asset = client.post("/assets", json=ASSET_PAYLOAD).json()

    response = client.put(
        f"/assets/{asset['id']}",
        json={**ASSET_PAYLOAD, "nome": "Carro atualizado"},
    )

    assert response.status_code == 200
    assert response.json()["nome"] == "Carro atualizado"


def test_delete_asset(client, db_session):
    _authenticate(client, db_session)
    asset = client.post("/assets", json=ASSET_PAYLOAD).json()

    delete_response = client.delete(f"/assets/{asset['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/assets/{asset['id']}")
    assert get_response.status_code == 404


def test_update_missing_asset_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.put("/assets/999", json=ASSET_PAYLOAD)

    assert response.status_code == 404


def test_delete_missing_asset_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.delete("/assets/999")

    assert response.status_code == 404


def test_sell_missing_asset_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.post(
        "/assets/999/sell", json={"valor_venda": "1.00", "data_venda": "2026-08-01"}
    )

    assert response.status_code == 404


def test_get_other_users_asset_returns_404(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    asset = client.post("/assets", json=ASSET_PAYLOAD).json()

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")

    response = client.get(f"/assets/{asset['id']}")

    assert response.status_code == 404
