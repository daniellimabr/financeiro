from sqlalchemy.orm import Session

from app.categories.seed import seed_categories_for_user
from app.models.user import User


def upsert_user_from_google(db: Session, *, google_sub: str, email: str, name: str) -> User:
    user = db.query(User).filter(User.google_sub == google_sub).one_or_none()

    if user is None:
        user = User(google_sub=google_sub, email=email, name=name)
        db.add(user)
        db.flush()
        seed_categories_for_user(db, user.id)
    else:
        user.email = email
        user.name = name

    db.commit()
    db.refresh(user)
    return user


def update_settings(db: Session, user: User, *, cutoff_dia: int) -> User:
    user.salario_competencia_cutoff_dia = cutoff_dia
    db.commit()
    db.refresh(user)
    return user
