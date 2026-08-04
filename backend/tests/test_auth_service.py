from app.auth.service import upsert_user_from_google
from app.models.user import User


def test_upsert_creates_new_user(db_session):
    user = upsert_user_from_google(
        db_session, google_sub="google-1", email="a@example.com", name="Alice"
    )

    assert user.id is not None
    assert db_session.query(User).count() == 1


def test_upsert_updates_existing_user(db_session):
    first = upsert_user_from_google(
        db_session, google_sub="google-1", email="a@example.com", name="Alice"
    )

    second = upsert_user_from_google(
        db_session, google_sub="google-1", email="alice@example.com", name="Alice B."
    )

    assert second.id == first.id
    assert db_session.query(User).count() == 1
    assert second.email == "alice@example.com"
    assert second.name == "Alice B."
