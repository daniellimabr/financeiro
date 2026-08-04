from app.auth.jwt import COOKIE_NAME, create_access_token
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
