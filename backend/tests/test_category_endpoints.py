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


def test_list_category_groups_without_cookie_returns_401(client):
    response = client.get("/category-groups")
    assert response.status_code == 401


def test_create_and_list_category_group(client, db_session):
    _authenticate(client, db_session)

    create_response = client.post("/category-groups", json={"nome": "Moradia"})
    assert create_response.status_code == 201

    list_response = client.get("/category-groups")
    assert list_response.status_code == 200
    assert [g["nome"] for g in list_response.json()] == ["Moradia"]


def test_create_duplicate_category_group_returns_400(client, db_session):
    _authenticate(client, db_session)
    client.post("/category-groups", json={"nome": "Moradia"})

    response = client.post("/category-groups", json={"nome": "moradia"})

    assert response.status_code == 400


def test_get_missing_category_group_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.get("/category-groups/999")

    assert response.status_code == 404


def test_create_and_list_subcategory(client, db_session):
    _authenticate(client, db_session)
    group = client.post("/category-groups", json={"nome": "Moradia"}).json()

    create_response = client.post(
        "/subcategories", json={"group_id": group["id"], "nome": "Aluguel", "natureza": "fixa"}
    )
    assert create_response.status_code == 201
    assert create_response.json()["natureza"] == "fixa"

    list_response = client.get(f"/subcategories?group_id={group['id']}")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_create_subcategory_with_invalid_natureza_returns_422(client, db_session):
    _authenticate(client, db_session)
    group = client.post("/category-groups", json={"nome": "Moradia"}).json()

    response = client.post(
        "/subcategories", json={"group_id": group["id"], "nome": "Aluguel", "natureza": "invalida"}
    )

    assert response.status_code == 422


def test_delete_category_group(client, db_session):
    _authenticate(client, db_session)
    group = client.post("/category-groups", json={"nome": "Moradia"}).json()

    delete_response = client.delete(f"/category-groups/{group['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/category-groups/{group['id']}")
    assert get_response.status_code == 404


def test_update_category_group(client, db_session):
    _authenticate(client, db_session)
    group = client.post("/category-groups", json={"nome": "Moradia"}).json()

    response = client.put(f"/category-groups/{group['id']}", json={"nome": "Moradia 2"})

    assert response.status_code == 200
    assert response.json()["nome"] == "Moradia 2"


def test_update_missing_category_group_returns_404(client, db_session):
    _authenticate(client, db_session)

    response = client.put("/category-groups/999", json={"nome": "Moradia"})

    assert response.status_code == 404


def test_update_category_group_to_duplicate_name_returns_400(client, db_session):
    _authenticate(client, db_session)
    client.post("/category-groups", json={"nome": "Moradia"})
    group_b = client.post("/category-groups", json={"nome": "Lazer"}).json()

    response = client.put(f"/category-groups/{group_b['id']}", json={"nome": "moradia"})

    assert response.status_code == 400


def test_get_update_delete_subcategory(client, db_session):
    _authenticate(client, db_session)
    group = client.post("/category-groups", json={"nome": "Moradia"}).json()
    subcategory = client.post(
        "/subcategories", json={"group_id": group["id"], "nome": "Aluguel", "natureza": None}
    ).json()

    get_response = client.get(f"/subcategories/{subcategory['id']}")
    assert get_response.status_code == 200

    update_response = client.put(
        f"/subcategories/{subcategory['id']}",
        json={"group_id": group["id"], "nome": "Aluguel novo", "natureza": "fixa"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["nome"] == "Aluguel novo"

    delete_response = client.delete(f"/subcategories/{subcategory['id']}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/subcategories/{subcategory['id']}")
    assert missing_response.status_code == 404


def test_update_missing_subcategory_returns_404(client, db_session):
    _authenticate(client, db_session)
    group = client.post("/category-groups", json={"nome": "Moradia"}).json()

    response = client.put(
        "/subcategories/999", json={"group_id": group["id"], "nome": "Aluguel", "natureza": None}
    )

    assert response.status_code == 404
