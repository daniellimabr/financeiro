from app.auth.jwt import COOKIE_NAME, create_access_token
from app.models.category import CategoryGroup, Subcategory
from app.models.user import User


def test_me_without_cookie_returns_401(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_valid_cookie_returns_user(client, db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)

    response = client.get("/auth/me")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "a@example.com"
    assert body["name"] == "Alice"


def test_me_with_invalid_cookie_returns_401(client):
    client.cookies.set(COOKIE_NAME, "not-a-valid-token")
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_includes_salario_competencia_cutoff_dia_default(client, db_session):
    user = User(google_sub="google-cutoff", email="cutoff@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)

    response = client.get("/auth/me")

    assert response.json()["salario_competencia_cutoff_dia"] == 25


def test_logout_without_cookie_returns_401(client):
    response = client.post("/auth/logout")
    assert response.status_code == 401


def test_logout_clears_cookie_and_invalidates_session(client, db_session):
    user = User(google_sub="google-logout", email="logout@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)

    response = client.post("/auth/logout")

    assert response.status_code == 204
    client.cookies.delete(COOKIE_NAME)
    me_response = client.get("/auth/me")
    assert me_response.status_code == 401


def test_update_settings_without_cookie_returns_401(client):
    response = client.put("/auth/me/settings", json={"cutoff_dia": 10})
    assert response.status_code == 401


def test_update_settings_updates_cutoff_dia(client, db_session):
    user = User(google_sub="google-settings", email="settings@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)

    response = client.put("/auth/me/settings", json={"cutoff_dia": 10})

    assert response.status_code == 200
    assert response.json()["salario_competencia_cutoff_dia"] == 10


def test_update_settings_rejects_cutoff_dia_out_of_range(client, db_session):
    user = User(google_sub="google-settings-2", email="settings2@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)

    response = client.put("/auth/me/settings", json={"cutoff_dia": 29})

    assert response.status_code == 422


def test_google_callback_creates_session_cookie(client, db_session, monkeypatch):
    async def fake_authorize_access_token(request):
        return {
            "userinfo": {
                "sub": "google-42",
                "email": "bob@example.com",
                "name": "Bob",
            }
        }

    monkeypatch.setattr(
        "app.auth.router.oauth.google.authorize_access_token",
        fake_authorize_access_token,
    )

    response = client.get("/auth/google/callback", follow_redirects=False)

    assert response.status_code in (302, 307)
    assert COOKIE_NAME in response.cookies

    user = db_session.query(User).filter(User.google_sub == "google-42").one()
    assert user.email == "bob@example.com"

    groups = db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).all()
    subcategories = db_session.query(Subcategory).filter(Subcategory.user_id == user.id).all()
    assert len(groups) > 0
    assert len(subcategories) > 0


def test_google_callback_does_not_reseed_categories_for_existing_user(
    client, db_session, monkeypatch
):
    async def fake_authorize_access_token(request):
        return {
            "userinfo": {
                "sub": "google-43",
                "email": "carol@example.com",
                "name": "Carol",
            }
        }

    monkeypatch.setattr(
        "app.auth.router.oauth.google.authorize_access_token",
        fake_authorize_access_token,
    )

    client.get("/auth/google/callback", follow_redirects=False)
    user = db_session.query(User).filter(User.google_sub == "google-43").one()
    count_after_first_login = (
        db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).count()
    )

    client.cookies.clear()
    client.get("/auth/google/callback", follow_redirects=False)
    count_after_second_login = (
        db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).count()
    )

    assert count_after_first_login > 0
    assert count_after_second_login == count_after_first_login
