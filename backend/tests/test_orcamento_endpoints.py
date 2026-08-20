from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.category import CategoryGroup, Subcategory
from app.models.user import User


def _authenticate(client, db_session, *, google_sub="google-1", email="a@example.com"):
    user = User(google_sub=google_sub, email=email, name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def _subcategory(db_session, user, nome="Aluguel"):
    group = CategoryGroup(user_id=user.id, nome=f"Grupo {nome}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(user_id=user.id, group_id=group.id, nome=nome)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def test_list_orcamentos_without_cookie_returns_401(client):
    response = client.get("/orcamentos")
    assert response.status_code == 401


def test_create_and_list_orcamento_eventual(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    create_response = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["tipo"] == "eventual"

    list_response = client.get("/orcamentos")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_create_orcamento_recorrente(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "recorrente",
            "valor": "800.00",
            "data_inicio": "2026-01-01",
        },
    )

    assert response.status_code == 201
    assert response.json()["data_inicio"] == "2026-01-01"
    assert response.json()["data_fim"] is None


def test_create_orcamento_eventual_with_data_inicio_returns_422(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
            "data_inicio": "2026-01-01",
        },
    )

    assert response.status_code == 422


def test_create_orcamento_eventual_without_ano_mes_returns_422(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.post(
        "/orcamentos",
        json={"subcategory_id": sub.id, "tipo": "eventual", "valor": "500.00"},
    )

    assert response.status_code == 422


def test_create_orcamento_recorrente_with_ano_mes_returns_422(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "recorrente",
            "valor": "500.00",
            "data_inicio": "2026-01-01",
            "ano": 2026,
            "mes": 1,
        },
    )

    assert response.status_code == 422


def test_create_orcamento_recorrente_without_data_inicio_returns_422(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.post(
        "/orcamentos",
        json={"subcategory_id": sub.id, "tipo": "recorrente", "valor": "500.00"},
    )

    assert response.status_code == 422


def test_create_orcamento_data_fim_before_data_inicio_returns_422(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)

    response = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "recorrente",
            "valor": "500.00",
            "data_inicio": "2026-06-01",
            "data_fim": "2026-01-01",
        },
    )

    assert response.status_code == 422


def test_create_orcamento_with_missing_subcategory_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.post(
        "/orcamentos",
        json={"subcategory_id": 999, "tipo": "eventual", "valor": "500.00", "ano": 2026, "mes": 3},
    )

    assert response.status_code == 404


def test_update_orcamento(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)
    created = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
        },
    ).json()

    response = client.put(
        f"/orcamentos/{created['id']}",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "600.00",
            "ano": 2026,
            "mes": 4,
        },
    )

    assert response.status_code == 200
    assert response.json()["valor"] == "600.00"


def test_delete_orcamento(client, db_session):
    user = _authenticate(client, db_session)
    sub = _subcategory(db_session, user)
    created = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
        },
    ).json()

    response = client.delete(f"/orcamentos/{created['id']}")

    assert response.status_code == 204
    assert client.get("/orcamentos").json() == []


def test_user_does_not_see_other_users_orcamentos(client, db_session):
    user_a = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    sub = _subcategory(db_session, user_a)
    client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
        },
    )
    client.cookies.clear()

    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")
    response = client.get("/orcamentos")

    assert response.status_code == 200
    assert response.json() == []


def test_update_other_users_orcamento_returns_404(client, db_session):
    user_a = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    sub = _subcategory(db_session, user_a)
    created = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
        },
    ).json()
    client.cookies.clear()

    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")
    response = client.put(
        f"/orcamentos/{created['id']}",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "999.00",
            "ano": 2026,
            "mes": 3,
        },
    )

    assert response.status_code == 404


def test_delete_other_users_orcamento_returns_404(client, db_session):
    user_a = _authenticate(client, db_session, google_sub="google-1", email="a@example.com")
    sub = _subcategory(db_session, user_a)
    created = client.post(
        "/orcamentos",
        json={
            "subcategory_id": sub.id,
            "tipo": "eventual",
            "valor": "500.00",
            "ano": 2026,
            "mes": 3,
        },
    ).json()
    client.cookies.clear()

    _authenticate(client, db_session, google_sub="google-2", email="b@example.com")
    response = client.delete(f"/orcamentos/{created['id']}")

    assert response.status_code == 404
