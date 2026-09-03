from app.auth.jwt import COOKIE_NAME, create_access_token
from app.config import settings
from app.models.pluggy import PluggyTransaction
from app.models.user import User


def _authenticate(client, db_session, *, google_sub, email, name="Alice"):
    user = User(google_sub=google_sub, email=email, name=name)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(user.id)
    client.cookies.set(COOKIE_NAME, token)
    return user


def test_enter_without_cookie_returns_401(client):
    response = client.get("/demo/enter", follow_redirects=False)
    assert response.status_code == 401


def test_enter_with_disallowed_email_returns_403_and_creates_no_demo_user(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="other@example.com")

    response = client.get("/demo/enter", follow_redirects=False)

    assert response.status_code == 403
    assert db_session.query(User).filter(User.is_demo.is_(True)).count() == 0


def test_enter_with_allowed_email_creates_demo_user_and_sets_new_cookie(client, db_session):
    real_user = _authenticate(
        client, db_session, google_sub="ceo", email=settings.demo_allowed_email
    )
    real_token = client.cookies.get(COOKIE_NAME)

    response = client.get("/demo/enter", follow_redirects=False)

    assert response.status_code in (302, 307)
    assert COOKIE_NAME in response.cookies
    assert response.cookies[COOKIE_NAME] != real_token

    demo_user = db_session.query(User).filter(User.is_demo.is_(True)).one()
    assert demo_user.id != real_user.id
    assert demo_user.email != settings.demo_allowed_email


def test_enter_is_idempotent_get_or_create(client, db_session):
    _authenticate(client, db_session, google_sub="ceo", email=settings.demo_allowed_email)
    real_token = client.cookies.get(COOKIE_NAME)

    client.get("/demo/enter", follow_redirects=False)
    client.cookies.set(COOKIE_NAME, real_token)
    client.get("/demo/enter", follow_redirects=False)

    assert db_session.query(User).filter(User.is_demo.is_(True)).count() == 1


def test_entering_demo_populates_transactional_data(client, db_session):
    _authenticate(client, db_session, google_sub="ceo", email=settings.demo_allowed_email)

    response = client.get("/demo/enter", follow_redirects=False)
    demo_token = response.cookies[COOKIE_NAME]

    client.cookies.set(COOKIE_NAME, demo_token)
    me_response = client.get("/auth/me")

    assert me_response.status_code == 200
    assert me_response.json()["is_demo"] is True

    demo_user = db_session.query(User).filter(User.is_demo.is_(True)).one()
    assert (
        db_session.query(PluggyTransaction)
        .filter(PluggyTransaction.user_id == demo_user.id)
        .count()
        > 0
    )


def test_reset_without_cookie_returns_401(client):
    response = client.post("/demo/reset")
    assert response.status_code == 401


def test_reset_with_disallowed_email_returns_403(client, db_session):
    _authenticate(client, db_session, google_sub="google-1", email="other@example.com")

    response = client.post("/demo/reset")

    assert response.status_code == 403


def test_reset_with_allowed_email_repopulates_without_duplicating(client, db_session):
    # Fica autenticado como o CEO (sessão real) durante todo o teste — o
    # reset não exige (nem deveria exigir) já estar na sessão demo.
    _authenticate(client, db_session, google_sub="ceo", email=settings.demo_allowed_email)
    first_reset = client.post("/demo/reset")
    assert first_reset.status_code == 204

    demo_user = db_session.query(User).filter(User.is_demo.is_(True)).one()
    count_before = (
        db_session.query(PluggyTransaction)
        .filter(PluggyTransaction.user_id == demo_user.id)
        .count()
    )

    response = client.post("/demo/reset")

    assert response.status_code == 204
    count_after = (
        db_session.query(PluggyTransaction)
        .filter(PluggyTransaction.user_id == demo_user.id)
        .count()
    )
    assert count_after == count_before
    assert db_session.query(User).filter(User.is_demo.is_(True)).count() == 1


def test_reset_does_not_affect_other_users_data(client, db_session):
    other_user = _authenticate(
        client, db_session, google_sub="google-other", email="other@example.com"
    )
    other_asset_response = client.post(
        "/assets",
        json={
            "nome": "Carro real",
            "tipo": "veiculo",
            "valor_atual": "1000.00",
            "data_aquisicao": "2024-01-01",
        },
    )
    assert other_asset_response.status_code == 201

    client.cookies.clear()
    _authenticate(client, db_session, google_sub="ceo", email=settings.demo_allowed_email)
    reset_response = client.post("/demo/reset")

    assert reset_response.status_code == 204

    from app.models.asset import Asset

    other_assets = db_session.query(Asset).filter(Asset.user_id == other_user.id).all()
    assert len(other_assets) == 1
    assert other_assets[0].nome == "Carro real"
