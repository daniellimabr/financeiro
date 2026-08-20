from app.categories.seed import seed_categories_for_user
from app.models.category import CategoryGroup, Subcategory
from app.models.user import User


def _user(db_session, google_sub="google-seed"):
    user = User(google_sub=google_sub, email=f"{google_sub}@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_seed_creates_groups_and_subcategories_for_user(db_session):
    user = _user(db_session)

    seed_categories_for_user(db_session, user.id)
    db_session.commit()

    groups = db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).all()
    subcategories = db_session.query(Subcategory).filter(Subcategory.user_id == user.id).all()

    assert len(groups) > 0
    assert len(subcategories) > 0
    assert all(g.user_id == user.id for g in groups)
    assert all(s.user_id == user.id for s in subcategories)
    nomes_grupos = {g.nome for g in groups}
    assert "Moradia" in nomes_grupos
    assert "Transferência interna" in nomes_grupos


def test_seed_is_idempotent_by_name(db_session):
    user = _user(db_session)

    seed_categories_for_user(db_session, user.id)
    db_session.commit()
    count_after_first = (
        db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).count()
    )

    seed_categories_for_user(db_session, user.id)
    db_session.commit()
    count_after_second = (
        db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).count()
    )

    assert count_after_first == count_after_second


def test_seed_isolated_between_users(db_session):
    user_a = _user(db_session, google_sub="google-seed-a")
    user_b = _user(db_session, google_sub="google-seed-b")

    seed_categories_for_user(db_session, user_a.id)
    db_session.commit()

    groups_b = db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user_b.id).all()
    assert groups_b == []


def test_seed_transferencia_interna_group_excludes_from_totais(db_session):
    user = _user(db_session)

    seed_categories_for_user(db_session, user.id)
    db_session.commit()

    transferencia = (
        db_session.query(CategoryGroup)
        .filter(CategoryGroup.user_id == user.id, CategoryGroup.nome == "Transferência interna")
        .one()
    )
    assert transferencia.excluir_de_totais is True
