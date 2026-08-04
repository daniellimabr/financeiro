from sqlalchemy.orm import Session

from app.models.user import User


def upsert_user_from_google(db: Session, *, google_sub: str, email: str, name: str) -> User:
    user = db.query(User).filter(User.google_sub == google_sub).one_or_none()

    if user is None:
        user = User(google_sub=google_sub, email=email, name=name)
        db.add(user)
    else:
        user.email = email
        user.name = name

    db.commit()
    db.refresh(user)
    return user
