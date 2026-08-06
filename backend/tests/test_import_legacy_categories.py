from pathlib import Path

from app.models.category import CategoryGroup, Subcategory
from scripts.import_legacy_categories import import_categories

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "legacy_categories_sample.csv"


def test_import_merges_duplicates_and_logs_conflicts(db_session, caplog):
    with caplog.at_level("WARNING"):
        stats = import_categories(db_session, FIXTURE_PATH)

    groups = db_session.query(CategoryGroup).all()
    subcategories = db_session.query(Subcategory).all()

    assert len(groups) == 2
    assert len(subcategories) == 3
    assert stats["groups_created"] == 2
    assert stats["subcategories_created"] == 3
    assert stats["conflicts"] == 1
    assert "Conflito" in caplog.text


def test_import_is_idempotent_on_second_run(db_session):
    import_categories(db_session, FIXTURE_PATH)
    stats_second_run = import_categories(db_session, FIXTURE_PATH)

    assert stats_second_run["groups_created"] == 0
    assert stats_second_run["subcategories_created"] == 0
    assert stats_second_run["conflicts"] == 4
