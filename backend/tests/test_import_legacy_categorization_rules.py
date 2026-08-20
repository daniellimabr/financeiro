import sys
from pathlib import Path

import pytest

from app.models.categorization import CategorizationRule
from app.models.category import CategoryGroup, Subcategory
from app.models.user import User
from scripts import import_legacy_categorization_rules as script_module
from scripts.import_legacy_categorization_rules import import_legacy_rules

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "semente_classificacao_sample.json"


@pytest.fixture()
def user(db_session):
    u = User(google_sub="google-1", email="ceo@example.com", name="CEO")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _taxonomy(db_session, user):
    group = CategoryGroup(user_id=user.id, nome="Alimentação")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(user_id=user.id, group_id=group.id, nome="Comer fora")
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


@pytest.fixture()
def taxonomy(db_session, user):
    return _taxonomy(db_session, user)


def test_import_creates_rule_and_logs_unresolved_category(db_session, taxonomy, user, caplog):
    with caplog.at_level("WARNING"):
        stats = import_legacy_rules(db_session, user.id, FIXTURE_PATH)

    rules = db_session.query(CategorizationRule).all()
    assert len(rules) == 1
    assert rules[0].user_id == user.id
    assert rules[0].subcategory_id == taxonomy.id
    assert rules[0].origem == "legado"
    assert stats == {"created": 1, "conflicts": 0, "unresolved": 1}
    assert "não resolvida" in caplog.text


def test_import_second_run_logs_conflict_and_does_not_duplicate(db_session, taxonomy, user, caplog):
    import_legacy_rules(db_session, user.id, FIXTURE_PATH)

    with caplog.at_level("WARNING"):
        stats_second_run = import_legacy_rules(db_session, user.id, FIXTURE_PATH)

    assert stats_second_run == {"created": 0, "conflicts": 1, "unresolved": 1}
    assert "Conflito" in caplog.text
    assert db_session.query(CategorizationRule).count() == 1


def test_import_is_isolated_per_user(db_session, taxonomy, user):
    other_user = User(google_sub="google-2", email="other@example.com", name="Other")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)
    _taxonomy(db_session, other_user)

    import_legacy_rules(db_session, user.id, FIXTURE_PATH)
    stats_other = import_legacy_rules(db_session, other_user.id, FIXTURE_PATH)

    assert stats_other["created"] == 1
    assert stats_other["conflicts"] == 0
    assert db_session.query(CategorizationRule).count() == 2


def test_main_aborts_when_user_email_not_found(db_session, monkeypatch, caplog):
    monkeypatch.setattr(script_module, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "import_legacy_categorization_rules.py",
            "--user-email",
            "missing@example.com",
            str(FIXTURE_PATH),
        ],
    )

    with caplog.at_level("ERROR"), pytest.raises(SystemExit) as exc_info:
        script_module.main()

    assert exc_info.value.code == 1
    assert db_session.query(CategorizationRule).count() == 0
